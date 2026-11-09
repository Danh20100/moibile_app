#!/usr/bin/env python3
"""TrọƠi owner queue & listing draft staging tool.

Workflow:
  validate -> preview -> [onboard --execute] -> [kyc --execute for primary identity] -> [apply --execute for isolated staging]

This tool never creates KYC evidence, paid entitlements, or public listings.
No production database writes or SQL schema migrations.
"""
from __future__ import annotations
import argparse
import base64
import hashlib
import json
import os
import re
import sys
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
METADATA = ROOT / 'metadata.json'
STATE = ROOT / 'output' / 'onboarding_state.json'
NAMESPACE = uuid.UUID('30a19c39-b26c-4f70-8067-5d772bf6b8bb')
AMENITY_IDS = {'wifi', 'air_conditioning', 'washing_machine', 'kitchen', 'private_bathroom',
               'balcony', 'parking', 'elevator', 'security_camera'}
FORBIDDEN_IN_PUBLIC_TEXT = ('demo', 'seed', 'fixture', 'metadata.json', 'lập trình viên', 'dữ liệu giả')
LOCAL_HOSTS = {'localhost', '127.0.0.1', '::1'}

class ToolError(Exception):
    pass


def read_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def load_metadata():
    return read_json(METADATA)


def file_digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for piece in iter(lambda: f.read(1024 * 1024), b''):
            h.update(piece)
    return h.hexdigest()


def validate(m: dict, *, strict_accounts=False, verify_images=True):
    problems, warnings = [], []
    accounts, props = m.get('accounts', []), m.get('properties', [])
    if len(accounts) != 4 or len(props) != 12:
        problems.append('Yêu cầu đúng 4 accounts và 12 properties')
    keys = [a['key'] for a in accounts]
    if len(set(keys)) != 4:
        problems.append('Trùng account key')
    counts = Counter(p['ownerKey'] for p in props)
    desired = m.get('assignment', {}).get('counts', {})
    for a in accounts:
        key=a['key']
        if counts[key] != a.get('listingCount') or counts[key] != desired.get(key):
            problems.append(f'{key}: phân bổ không khớp')
        reg=a['registration']
        if strict_accounts:
            if not reg.get('fullName') or len(reg['fullName'].strip()) < 2 or len(reg['fullName']) > 80:
                problems.append(f'{key}: thiếu/sai fullName')
            if not isinstance(reg.get('phone'),str) or not re.fullmatch(r'0[0-9]{9,10}',reg['phone']):
                problems.append(f'{key}: thiếu/sai phone')
            email=reg.get('email')
            if not isinstance(email,str) or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email) or len(email)>254 or email.endswith('.test'):
                problems.append(f'{key}: email thực chưa được cấu hình')
            p_env=reg['passwordEnv']
            if not os.getenv(p_env) or not 8 <= len(os.environ[p_env]) <= 128:
                problems.append(f'{key}: chưa cấu hình password 8..128 ký tự qua env {p_env}')
        if reg.get('otp',{}).get('verificationMode') != 'TERMINAL_PROMPT':
            problems.append(f'{key}: OTP phải được nhập qua terminal')
    identity=m.get('operatorIdentity', {})
    primary=identity.get('primaryAccountKey')
    if primary not in keys:
        problems.append('operatorIdentity.primaryAccountKey phải trỏ một account có thật')
    if identity.get('reuseAsIdentityForOtherAccounts') is not False or identity.get('autoSetOfficialVerified') is not False:
        problems.append('Không dùng một CCCD làm KYC cho nhiều danh tính hoặc tự đặt VERIFIED')
    if identity.get('consentVersion') != 'kyc-auto-v1' or identity.get('assurance') != 'FACE_SIMILARITY_ONLY':
        problems.append('KYC contract không tương thích backend')
    if identity.get('submissionMode') != 'EXPLICIT_TERMINAL_CONSENT':
        problems.append('Cần xác nhận KYC thủ công tại Terminal')
    for field in ('idFrontPath', 'idBackPath', 'selfiePath'):
        rel=identity.get(field)
        if not isinstance(rel,str) or not rel.startswith('private_kyc/') or '..' in Path(rel).parts:
            problems.append(f'operatorIdentity.{field} phải thuộc private_kyc/')
    ems=[a['registration'].get('email','') for a in accounts if a['registration'].get('email')]
    if len(set(e.lower() for e in ems)) != len(ems):
        problems.append('Email các tài khoản phải khác nhau')
    if sorted(p['key'] for p in props) != [f'listing_{i:02}' for i in range(1,13)]:
        problems.append('Listing keys không đủ hoặc trùng')
    media_count=0
    for p in props:
        key=p['key']; detail=p['listing']; provenance=p['provenance']
        s=' '.join(detail['description']['paragraphs'])
        words=len(s.split())
        if words < 150:
            problems.append(f'{key}: mô tả quá ngắn ({words} từ)')
        if any(x in s.lower() for x in FORBIDDEN_IN_PUBLIC_TEXT):
            problems.append(f'{key}: nội dung public chứa thuật ngữ nội bộ')
        if not set(detail['amenityIds']) <= AMENITY_IDS:
            problems.append(f'{key}: amenity ID không nằm trong catalog backend')
        if detail.get('status') != 'DRAFT':
            problems.append(f'{key}: tool chỉ tạo listing DRAFT')
        if not -90 <= p['property']['location']['latitude'] <= 90 or not -180 <= p['property']['location']['longitude'] <= 180:
            problems.append(f'{key}: tọa độ ngoài phạm vi')
        if detail.get('monthlyRent') is None or not all(provenance.get(k,False) for k in ['ownershipAuthorized','mediaRightsConfirmed','availabilityConfirmed','priceConfirmed','areaConfirmed','depositConfirmed','addressConfirmed','locationConfirmed','amenitiesConfirmed']):
            warnings.append(f'{key}: còn dữ liệu/giấy phép chưa được xác thực; chưa thể công khai')
        photos=detail['photos']
        if not 1<=len(photos)<=10:
            problems.append(f'{key}: media phải từ 1 đến 10 ảnh')
        media_count+=len(photos)
        for photo in photos:
            path=ROOT/photo['path']
            if not photo['path'].startswith('images/') or '..' in Path(photo['path']).parts:
                problems.append(f'{key}: đường dẫn ảnh không hợp lệ')
                continue
            if not path.is_file():
                problems.append(f'{key}: thiếu {photo["path"]}')
            elif verify_images:
                if file_digest(path) != photo['sha256'] or path.stat().st_size != photo['bytes']:
                    problems.append(f'{key}: ảnh sai checksum/bytes {photo["path"]}')
    if media_count!=40:
        problems.append(f'Ảnh: cần 40, hiện {media_count}')
    if m['environment']['productionPublicationEnabled'] or m['environment']['publicListingStatus'] != 'DRAFT':
        problems.append('Chỉ được build DRAFT; không công khai dữ liệu chưa xác minh')
    if any(m['businessRules'][x] for x in ['createTenantAccounts','createTenancies','createPayments','createSlotPurchases','createSlotEntitlements']):
        problems.append('Tool không được sinh người thuê, payments hoặc giao dịch slot')
    return problems, warnings


def load_state():
    return read_json(STATE) if STATE.exists() else {'seedId':load_metadata()['seedId'],'accounts':{},'imported':{}}


def save_state(state):
    STATE.parent.mkdir(exist_ok=True)
    tmp=STATE.with_suffix('.tmp')
    tmp.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    try: os.chmod(tmp, 0o600)
    except OSError: pass
    tmp.replace(STATE)


def account_plan(m):
    return [(a,[p for p in m['properties'] if p['ownerKey']==a['key']]) for a in m['accounts']]


def cmd_validate(m, args):
    errors,warnings=validate(m, strict_accounts=args.strict)
    for err in errors: print('ERROR:',err)
    for warn in warnings: print('REVIEW:',warn)
    print(f'Kết quả: {len(errors)} errors; {len(warnings)} pending reviews; 4 accounts / 12 listings / 40 images')
    return 2 if errors else 0


def cmd_preview(m, args):
    errors,_=validate(m)
    if errors: raise ToolError('\n'.join(errors))
    out=ROOT/'output';out.mkdir(exist_ok=True)
    lines=['# TrọƠi — Listing review (private)', '', '**Chưa xuất bản lên production.**','']
    report={'seedId':m['seedId'],'owners':[],'listingCount':12,'photoCount':40,'published':0}
    for a,props in account_plan(m):
        lines.append(f'## {a["key"]} — {len(props)} phòng')
        report['owners'].append({'ownerKey':a['key'],'email':a['registration']['email'],'listings':[p['key'] for p in props]})
        for p in props:
            item=p['listing'];links=', '.join(item['amenityIds']) or '(chưa xác minh)'
            lines.extend(['',f'### {p["key"]} — {item["title"]}', f'* Giá nguồn: {item["monthlyRent"] or "CHƯA XÁC MINH"} VND/tháng',f'* Địa chỉ nguồn: {p["property"]["address"]}',f'* Tiện ích từ nguồn: {links}',f'* Hình ảnh: {len(item["photos"])}', '',*item['description']['paragraphs'],''])
    (out/'preview.md').write_text('\n'.join(lines),encoding='utf-8')
    (out/'preview.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    for a,props in account_plan(m):
        print(f'{a["key"]:10} {a["registration"]["email"] or "<chưa nhập email>":35} {len(props)} phòng: '+', '.join(p['key'] for p in props))
    print('Preview:',out/'preview.md')
    return 0


def api_request(base, path, data, *, token=None, method='POST'):
    endpoint=base.rstrip('/')+'/'+path.lstrip('/')
    headers={'Content-Type':'application/json','Accept':'application/json'}
    if token: headers['Authorization']='Bearer '+token
    raw=json.dumps(data,ensure_ascii=False).encode('utf-8') if data is not None else None
    req=Request(endpoint,data=raw,headers=headers,method=method)
    try:
        with urlopen(req,timeout=25) as response:
            result=json.loads(response.read().decode('utf-8'))
    except HTTPError as e:
        raw_error=e.read(2000).decode('utf-8','replace')
        raise ToolError(f'HTTP {e.code} {path}: {raw_error}') from e
    except (URLError,TimeoutError,ValueError) as e:
        raise ToolError(f'Không thể kết nối {path}: {e}') from e
    if isinstance(result,dict):
        for wrapper in ('data','result'):
            if isinstance(result.get(wrapper),dict): return result[wrapper]
    return result


def base_url(m):
    base=os.getenv(m['environment']['apiBaseUrlEnv'],'').strip()
    if not base: raise ToolError('Thiếu biến môi trường '+m['environment']['apiBaseUrlEnv'])
    parsed=urlparse(base)
    if parsed.scheme not in {'https','http'} or (parsed.scheme=='http' and parsed.hostname not in LOCAL_HOSTS):
        raise ToolError('API chỉ cho phép HTTPS hoặc HTTP trên localhost')
    return base


def legal_acknowledgement(email):
    print(f'\nTài khoản {email}: người chủ hộp thư cần đọc/đồng ý điều khoản sử dụng và quyền riêng tư trước khi đăng ký.')
    answer=input('Người có quyền sử dụng tài khoản đã đồng ý? Nhập YES để tiếp tục: ').strip()
    if answer!='YES': raise ToolError('Không có xác nhận điều khoản; không thực hiện đăng ký')


def onboard(m, account, state, *, live):
    reg=account['registration'];key=account['key'];email=reg['email']
    print(f'\n[{key}] {email}')
    if not live:
        print(f'  DRY RUN: gửi email OTP -> nhập "OTP của {email}:" -> verify -> cập nhật profile')
        return None
    base=base_url(m)
    password=os.environ[reg['passwordEnv']]
    entry=state['accounts'].get(key)
    if entry:
        if entry['email'].lower()!=email.lower(): raise ToolError(f'{key}: state email khác metadata')
        print('  Account có trong checkpoint; đăng nhập lại bằng mật khẩu để lấy session mới.')
        session=api_request(base,'identity-access/auth/password',{'email':email,'password':password})
        if session.get('userId')!=entry['userId']:raise ToolError('Session userId không khớp checkpoint')
    else:
        legal_acknowledgement(email)
        issued=api_request(base,'identity-access/register/email/otp/request',{'email':email,'password':password,'displayName':reg['fullName']})
        challenge=issued.get('otpChallengeId')
        if not challenge:raise ToolError('Backend không trả otpChallengeId')
        print(f'  [OK] OTP đã yêu cầu gửi đến: {email}')
        print(f'  Challenge hết hạn: {issued.get("expiresAt","(không có thông tin)")}')
        code=input(f'OTP của {email}: ').strip()
        if not re.fullmatch(r'\d{6}',code):raise ToolError('OTP phải đúng 6 chữ số; dừng và chạy lại khi cần')
        session=api_request(base,'identity-access/register/email/otp/verify',{'otpChallengeId':challenge,'code':code})
        user_id=session.get('userId')
        if not user_id:raise ToolError('Backend không trả userId sau xác minh OTP')
        state['accounts'][key]={'email':email,'userId':user_id,'emailVerifiedAt':datetime.now(timezone.utc).isoformat()}
        save_state(state)
        print(f'  [OK] Đã tạo user: {user_id}')
    token=session.get('accessToken')
    if not token:raise ToolError('Không có accessToken để cập nhật profile')
    contact={'phoneNumber':reg['phone']}
    addr=account['profile'].get('residentialAddress')
    if addr:contact['residentialAddress']=addr
    api_request(base,'identity-access/profile/contact',contact,token=token,method='PATCH')
    display_name=account.get('profile',{}).get('displayName')
    if display_name and display_name!=reg['fullName']:
        api_request(base,'identity-access/profile',{'displayName':display_name},token=token,method='PATCH')
    print('  [OK] Đã cập nhật profile/contact qua API chính thức')
    print('  [INFO] KYC phải hoàn tất qua quy trình hợp lệ riêng; công cụ không gán trạng thái KYC.')
    return state['accounts'][key]['userId']




def kyc_files(m):
    """Read photos of the single declared real identity, never persist photo bytes.

    Confined to private_kyc under tool root to prevent cross-directory access.
    The API performs only face similarity; this is not an official identity proof.
    """
    cfg=m['operatorIdentity']
    if cfg.get('reuseAsIdentityForOtherAccounts') is not False or cfg.get('autoSetOfficialVerified') is not False:
        raise ToolError('KYC nhiều danh tính hoặc tự đặt VERIFIED không được hỗ trợ')
    base=(ROOT/'private_kyc').resolve()
    collected={}
    for key in ('idFrontPath','idBackPath','selfiePath'):
        rel=cfg.get(key,'')
        if not isinstance(rel,str) or not rel.startswith('private_kyc/') or '..' in Path(rel).parts:
            raise ToolError(f'Dường dẫn {key} không hợp lệ')
        file=(ROOT/rel).resolve()
        if not file.is_relative_to(base) or not file.is_file():
            raise ToolError(f'Không có file {rel} (xem RUNBOOK_DUY_ANH.md)')
        data=file.read_bytes()
        if not (100<=len(data)<=1_500_000 and data[:2]==b'\xff\xd8' and data[-2:]==b'\xff\xd9'):
            raise ToolError(f'{rel}: phải là JPEG hợp lệ, 100..1.500.000 bytes')
        collected[key]=data
    return collected


def cmd_kyc_check(m):
    files=kyc_files(m)
    key=m['operatorIdentity']['primaryAccountKey']
    print(f'[OK] 3 ảnh JPEG cho duy nhất {key}:')
    for name,photo in files.items():
        print(f'  {name}: {len(photo)} bytes')
    print('[INFO] Ảnh sẽ KHÔNG được copy vào metadata, database, checkpoint hoặc output.')
    print('[INFO] KYC chỉ so khớp khuôn mặt, không xác thực CCCD chính thức.')
    return 0


def submit_primary_kyc(m, account, state, *, live):
    cfg=m['operatorIdentity']
    key=cfg['primaryAccountKey']
    if account['key']!=key:
        raise ToolError('Không dùng CCCD của người vận hành để KYC account khác')
    email=account['registration']['email']
    if not live:
        print(f'  DRY RUN: KYC ảnh CCCD/selfie của chính chủ tài khoản {key} ({email})')
        return None
    files=kyc_files(m)
    checkpoint=state.get('accounts',{}).get(key)
    if not checkpoint or str(checkpoint.get('email','')).lower()!=email.lower() or not checkpoint.get('userId'):
        raise ToolError(f'Chưa có account {key} đã xác minh OTP trong checkpoint; chạy onboard --execute trước')
    print('\n[REAL IDENTITY CHECK]')
    print(f'Tài khoản duy nhất được gửi ảnh: {key} / {email} / {checkpoint["userId"]}')
    print('Phép kiểm tra chỉ đo tương đồng khuôn mặt, KHÔNG chứng thực CCCD, liveness hay quyền đăng trọ.')
    print('Ba ảnh phải thuộc đúng người sở hữu tài khoản này; không dùng kết quả cho B/C/D.')
    approved=input(f'Chủ giấy tờ đã đọc và đồng ý gửi 3 ảnh để so khớp cho {email}? Gõ CONSENT {key.upper()}: ').strip()
    if approved!=f'CONSENT {key.upper()}':
        raise ToolError('Chưa có đồng ý xử lý ảnh; không gửi KYC')
    base=base_url(m)
    password=os.getenv(account['registration']['passwordEnv'])
    if not password:raise ToolError('Thiếu biến môi trường mật khẩu tài khoản')
    session=api_request(base,'identity-access/auth/password',{'email':email,'password':password})
    if session.get('userId')!=checkpoint['userId']:
        raise ToolError('Session userId không khớp tài khoản đã xác minh email')
    token=session.get('accessToken')
    if not token:raise ToolError('Không có access token từ backend')
    payload={
        'consent':True,
        'consentVersion':cfg['consentVersion'],
        'frontImageBase64':base64.b64encode(files['idFrontPath']).decode('ascii'),
        'backImageBase64':base64.b64encode(files['idBackPath']).decode('ascii'),
        'selfieImageBase64':base64.b64encode(files['selfiePath']).decode('ascii'),
    }
    result=api_request(base,'identity-verification/auto-check',payload,token=token)
    if not isinstance(result,dict) or result.get('state') not in ('AUTO_CHECK_PASSED','NEEDS_RETRY'):
        raise ToolError('Backend không trả receipt kiểm tra khuôn mặt hợp lệ')
    if result.get('assurance')!='FACE_SIMILARITY_ONLY':
        raise ToolError('Backend trả assurance ngoài phạm vi')
    print(f'  Kết quả: {result["state"]}; assurance={result["assurance"]}')
    print('  Không đánh dấu hồ sơ là VERIFIED và không tạo receipt cho các tài khoản khác.')
    # Deliberately do not save any image/OTP/session token or forged verification status.
    return {'state':result['state'],'assurance':result['assurance']}


def check_staging_db(m):
    env=m['environment']['databaseUrlEnv']
    url=os.getenv(env,'')
    if not url: raise ToolError(f'Thiếu {env} để import DRAFT trong database staging')
    parsed=urlparse(url)
    if parsed.scheme not in ('postgres','postgresql') or parsed.hostname not in LOCAL_HOSTS:
        raise ToolError('Chỉ chấp nhận PostgreSQL local staging (không production/remote)')
    name=parsed.path.lstrip('/').split('/')[0]
    if name not in m['environment']['allowedWriteDatabaseNames']:
        raise ToolError(f'Database {name} không có trong allowlist staging')
    return url


def s3_client(m):
    try: import boto3
    except ImportError as exc: raise ToolError('Cần python -m pip install -r requirements.txt để upload ảnh') from exc
    cfg=m['media']
    endpoint=os.getenv(cfg['endpointEnv'],'')
    bucket=os.getenv(cfg['bucketEnv'],'')
    key=os.getenv(cfg['accessKeyEnv'],'')
    secret=os.getenv(cfg['secretKeyEnv'],'')
    parsed=urlparse(endpoint)
    if parsed.scheme!='http' or parsed.hostname not in LOCAL_HOSTS:
        raise ToolError('Media object storage chỉ được upload lên MinIO localhost staging')
    if not bucket.startswith('trooi-demo-') or not key or not secret:
        raise ToolError('Bucket phải bắt đầu trooi-demo- và đủ S3 credentials')
    return boto3.client('s3',endpoint_url=endpoint,aws_access_key_id=key,aws_secret_access_key=secret),bucket


def stable_uuid(seed,key,kind):
    return str(uuid.uuid5(NAMESPACE, f'{seed}:{kind}:{key}'))


def import_staging_drafts(m, account, records, user_id):
    url=check_staging_db(m)
    try: import psycopg
    except ImportError as exc: raise ToolError('Cần python -m pip install -r requirements.txt để import PostgreSQL') from exc
    client,bucket=s3_client(m)
    seed=m['seedId']
    owner_key=account['key']
    org_id=stable_uuid(seed,owner_key,'organization')
    # Pre-upload verified files before starting database transaction. Idempotent object keys.
    media=[]
    for p in records:
        listing_id=stable_uuid(seed,p['key'],'listing')
        for photo in p['listing']['photos']:
            path=ROOT/photo['path']
            if file_digest(path)!=photo['sha256']:
                raise ToolError(f'Ảnh bị thay đổi: {path}')
            media_id=stable_uuid(seed,photo['path'],'media')
            key=f'{m["media"]["prefix"]}/{listing_id}/{media_id}.png'
            client.upload_file(str(path),bucket,key,ExtraArgs={'ContentType':'image/png'})
            media.append((p['key'],media_id,key,photo))
    print(f'  [OK] Uploaded {len(media)} staged images to MinIO localhost')
    with psycopg.connect(url,connect_timeout=6) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute("SET LOCAL statement_timeout = '40s'")
                cur.execute('SELECT current_database()')
                dbname=cur.fetchone()[0]
                if dbname not in m['environment']['allowedWriteDatabaseNames']:
                    raise ToolError('Database thực tế không nằm trong allowlist')
                cur.execute('SELECT 1 FROM user_emails WHERE user_id=%s::uuid AND lower(email_address)=lower(%s) AND verified_at IS NOT NULL', (user_id,account['registration']['email']))
                if not cur.fetchone():raise ToolError('Owner không có email verified trong DB staging')
                cur.execute('INSERT INTO organizations(organization_id,primary_owner_user_id,name) VALUES(%s::uuid,%s::uuid,%s) ON CONFLICT (organization_id) DO NOTHING', (org_id,user_id,'Không gian quản lý của '+account['registration']['fullName']))
                for p in records:
                    key=p['key']; info=p['listing']; prop=p['property']; room=p['room'];loc=prop['location']; lat,lon=loc['latitude'],loc['longitude']
                    prop_id=stable_uuid(seed,key,'property');room_id=stable_uuid(seed,key,'room'); listing_id=stable_uuid(seed,key,'listing')
                    cur.execute('''INSERT INTO properties(property_id,organization_id,name,lifecycle_status,operational_address_text,operational_location,public_location_projection)
                        VALUES (%s::uuid,%s::uuid,%s,'ACTIVE',%s,ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography,ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography)
                        ON CONFLICT (property_id) DO NOTHING''',(prop_id,org_id,prop['name'],prop['address'],lon,lat,lon,lat))
                    cur.execute('''INSERT INTO rooms(room_id,property_id,name_or_label,operational_state,record_lifecycle)
                        VALUES(%s::uuid,%s::uuid,%s,'VACANT','ACTIVE') ON CONFLICT (room_id) DO NOTHING''',(room_id,prop_id,room['name']))
                    # Source package's example price for listing #11 is reserved for unpublished staging drafts only.
                    rent=info['monthlyRent'] or info['provisionalRentFromSourcePackage']
                    if not isinstance(rent,int) or rent<0:raise ToolError(f'{key}: staging DRAFT thiếu numeric rent')
                    cur.execute('''INSERT INTO listings(listing_id,room_id,status,public_title,public_description,public_price_projection,public_location_projection)
                        VALUES(%s::uuid,%s::uuid,'DRAFT',%s,%s,%s,ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography)
                        ON CONFLICT (listing_id) DO NOTHING''',(listing_id,room_id,info['title'],'\n\n'.join(info['description']['paragraphs']),str(rent),lon,lat))
                    cur.execute('''INSERT INTO listing_asset_details(listing_id,management_status,asset_type,public_area_label,area_square_meters,advertised_deposit,bedrooms,bathrooms,furnishing,amenity_ids,rules,electricity_offer,water_offer,service_offer,minimum_term_months,available_from,bathroom_arrangement,max_occupants,floor_label)
                        VALUES(%s::uuid,'DRAFT',%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        ON CONFLICT (listing_id) DO NOTHING''',(listing_id,info['assetType'],str(info['areaSquareMeters'])+' m²',str(info['areaSquareMeters']),str(info['deposit']) if info['deposit'] is not None else None,info['bedrooms'],info['bathrooms'],None,info['amenityIds'],info['rules'],info['electricityOffer'],info['waterOffer'],info['serviceOffer'],info['minimumTermMonths'],info['availableFrom'],info['bathroomArrangement'],room['maxOccupants'],info['floorLabel']))
                    for name,media_id,obj_key,photo in [x for x in media if x[0]==key]:
                        cur.execute('''INSERT INTO listing_asset_media(media_id,listing_id,object_key,content_type,byte_size,position,public_approved)
                            VALUES(%s::uuid,%s::uuid,%s,'image/png',%s,%s,FALSE)
                            ON CONFLICT (media_id) DO NOTHING''',(media_id,listing_id,obj_key,photo['bytes'],photo['position']))
                # Prevent accidental promotion of any known tool listings to PUBLISHED through repeat runs.
                ids=[stable_uuid(seed,p['key'],'listing') for p in records]
                cur.execute('SELECT listing_id FROM listings WHERE listing_id=ANY(%s::uuid[]) AND status<>%s',(ids,'DRAFT'))
                if cur.fetchall():raise ToolError('Một listing hiện đã công khai; tool từ chối chạy lại trên bộ dữ liệu này')
    print(f'  [OK] {len(records)} listing DRAFT, không công khai; media public_approved=FALSE')
    return True


def main():
    parser=argparse.ArgumentParser(description='TrọƠi listing onboarding & staging drafts (không bypass OTP/KYC)')
    sub=parser.add_subparsers(dest='cmd',required=True)
    sub.add_parser('preview')
    sub.add_parser('kyc-check', help='Kiểm tra 3 ảnh JPEG riêng của người vận hành, không gửi đi')
    val=sub.add_parser('validate');val.add_argument('--strict',action='store_true',help='Yêu cầu đã nhập email/phone/password env thật')
    single=sub.add_parser('kyc',help='KYC chỉ cho người thật tại primaryAccountKey')
    single.add_argument('--execute',action='store_true',help='Gửi ảnh sau consent; mặc định dry-run')
    for name in ('onboard','apply'):
        c=sub.add_parser(name);c.add_argument('--execute',action='store_true',help='Thực thi; mặc định chỉ dry-run')
        c.add_argument('--with-kyc',action='store_true',help='KYC đúng primary account trong queue, không KYC các account khác')
    args=parser.parse_args()
    try:
        m=load_metadata()
        if args.cmd=='validate':return cmd_validate(m,args)
        if args.cmd=='preview':return cmd_preview(m,args)
        if args.cmd=='kyc-check':
            errors,_=validate(m)
            if errors:raise ToolError('\n'.join(errors))
            return cmd_kyc_check(m)
        if args.cmd=='kyc':
            errors,_=validate(m,strict_accounts=args.execute)
            if errors:raise ToolError('\n'.join(errors))
            key=m['operatorIdentity']['primaryAccountKey']
            account=next(a for a in m['accounts'] if a['key']==key)
            return 0 if submit_primary_kyc(m,account,load_state(),live=args.execute) is not False else 2
        strict=args.execute
        errors,warnings=validate(m,strict_accounts=strict)
        if errors:raise ToolError('\n'.join(errors))
        print(f'TrọƠi queue — {args.cmd.upper()} (execute={args.execute})')
        print('Quy trình: ACCOUNT -> OTP terminal -> profile -> 5/3/2/2 DRAFT -> account kế tiếp.')
        if args.with_kyc and args.execute:
            kyc_files(m)  # Preflight before registration; avoid half-complete queue if images are missing.
        if args.cmd=='apply' and args.execute:
            check_staging_db(m)
            if urlparse(base_url(m)).hostname not in LOCAL_HOSTS:
                raise ToolError('APPLY chỉ chấp nhận local staging backend. Dùng onboard riêng nếu backend ở nơi khác.')
            s3_client(m)
            response=input('Chỉ chạy trên DB và MinIO staging độc lập. Nhập STAGING để tiếp tục: ')
            if response!='STAGING':raise ToolError('Đã hủy')
        state=load_state()
        for i,(a,props) in enumerate(account_plan(m),1):
            print(f'\n==== [{i}/4] {a["key"]} -> {len(props)} phòng ====')
            user_id=onboard(m,a,state,live=args.execute)
            if args.with_kyc and a['key']==m['operatorIdentity']['primaryAccountKey']:
                submit_primary_kyc(m,a,state,live=args.execute)
            if args.cmd=='apply' and args.execute:
                if state['imported'].get(a['key'])=='done':
                    print('  [SKIP] Đã import theo checkpoint, không ghi đè')
                else:
                    import_staging_drafts(m,a,props,user_id)
                    state['imported'][a['key']]='done';save_state(state)
            else:
                for p in props:print(f'  [PLAN] {p["key"]}: {p["listing"]["title"]} (DRAFT)')
        print('\n[COMPLETE] Queue kết thúc. Chỉ có KYC một danh tính thực nếu được chọn; không có slot purchase hoặc PUBLISHED listing.')
        return 0
    except (ToolError,FileNotFoundError,KeyError,ValueError,KeyboardInterrupt) as err:
        print('\n[STOP] '+str(err),file=sys.stderr)
        print('Có thể chạy lại để tiếp tục: checkpoint không lưu OTP hay password.',file=sys.stderr)
        return 2

if __name__=='__main__':sys.exit(main())
