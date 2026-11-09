"""Pure local regression tests; never send OTPs or connect to a database."""
from __future__ import annotations
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('onboarder',ROOT/'run.py')
app=importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)

class ToolTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.meta=app.load_metadata()

    def test_owners_listings_images(self):
        errors,warnings=app.validate(self.meta)
        self.assertEqual(errors,[])
        self.assertEqual(len(warnings),12)
        self.assertEqual([len(p) for _,p in app.account_plan(self.meta)],[5,3,2,2])
        self.assertEqual(sum(len(p['listing']['photos']) for p in self.meta['properties']),40)

    def test_public_description_not_dev_words(self):
        for p in self.meta['properties']:
            s=' '.join(p['listing']['description']['paragraphs']).lower()
            self.assertGreaterEqual(len(s.split()),150)
            self.assertFalse(any(key in s for key in app.FORBIDDEN_IN_PUBLIC_TEXT))
            self.assertEqual(p['listing']['status'],'DRAFT')

    def test_owner_determinism(self):
        keys=[p['key'] for p in self.meta['properties']]
        self.assertEqual(len(keys),len(set(keys)))
        self.assertEqual(app.stable_uuid(self.meta['seedId'],'listing_01','listing'),
                         app.stable_uuid(self.meta['seedId'],'listing_01','listing'))

    def test_checksum_tampering_detected(self):
        item=self.meta['properties'][0]['listing']['photos'][0]
        modified={**self.meta,'properties':list(self.meta['properties'])}
        clone=dict(self.meta['properties'][0])
        clone_listing=dict(clone['listing'])
        clone_listing['photos']=[dict(x) for x in clone_listing['photos']]
        clone_listing['photos'][0]['sha256']='0'*64
        clone['listing']=clone_listing
        modified['properties'][0]=clone
        errors,_=app.validate(modified)
        self.assertTrue(any('checksum' in err for err in errors))

    def test_production_publication_refused(self):
        modified={**self.meta,'environment':{**self.meta['environment'],'productionPublicationEnabled':True}}
        errors,_=app.validate(modified,verify_images=False)
        self.assertTrue(any('DRAFT' in err for err in errors))

    def test_db_host_restriction(self):
        with patch.dict('os.environ',{'TROOI_STAGE_DATABASE_URL':'postgresql://guest:pw@database.example.com/trooi_dev'}):
            with self.assertRaises(app.ToolError):app.check_staging_db(self.meta)

    def test_staging_only_database_name(self):
        with patch.dict('os.environ',{'TROOI_STAGE_DATABASE_URL':'postgresql://guest:pw@localhost/trooi_production'}):
            with self.assertRaises(app.ToolError):app.check_staging_db(self.meta)

    def test_queue_otp_registration_and_profile(self):
        account=self.meta['accounts'][0]
        account={**account,'registration':{**account['registration'],
                     'fullName':'Nguyễn Văn Test','phone':'0900000001','email':'test@example.com'},
                     'profile':{**account['profile'],'displayName':'Nguyễn Văn Test'}}
        calls=[]
        def fake_api(base,path,data,*,token=None,method='POST'):
            calls.append((path,data,method))
            if path.endswith('/request'):return {'otpChallengeId':'cee0efb4-e0b5-42e8-b80f-7d0a236d9ddb','expiresAt':'2030-01-01'}
            if path.endswith('/verify'):return {'userId':'id-1','accessToken':'token-1'}
            return {'ok':True}
        with tempfile.TemporaryDirectory() as dir:
            with patch.object(app,'STATE',Path(dir)/'state.json'), patch.object(app,'api_request',side_effect=fake_api), patch.object(app,'base_url',return_value='http://localhost:3000'), patch.object(app,'legal_acknowledgement'), patch('builtins.input',return_value='123456'), patch.dict('os.environ',{'TROOI_OWNER_A_PASSWORD':'ABCDEFGH'}):
                state={'seedId':'test','accounts':{},'imported':{}}
                result=app.onboard(self.meta,account,state,live=True)
                self.assertEqual(result,'id-1')
                self.assertTrue((Path(dir)/'state.json').exists())
        self.assertEqual([c[0] for c in calls],['identity-access/register/email/otp/request','identity-access/register/email/otp/verify','identity-access/profile/contact'])
        self.assertEqual(calls[0][1]['displayName'],'Nguyễn Văn Test')
        self.assertEqual(calls[1][1]['code'],'123456')
        self.assertEqual(calls[2][1]['phoneNumber'],'0900000001')


    def test_single_real_identity_policy(self):
        modified={**self.meta,'operatorIdentity':{**self.meta['operatorIdentity'],
                     'reuseAsIdentityForOtherAccounts':True}}
        errors,_=app.validate(modified,verify_images=False)
        self.assertTrue(any('CCCD' in x for x in errors))
        modified={**self.meta,'operatorIdentity':{**self.meta['operatorIdentity'],
                     'autoSetOfficialVerified':True}}
        errors,_=app.validate(modified,verify_images=False)
        self.assertTrue(any('VERIFIED' in x for x in errors))

    def test_identity_images_not_shipped_in_archive(self):
        private=ROOT/'private_kyc'
        self.assertFalse((private/'front.jpg').exists())
        self.assertFalse((private/'back.jpg').exists())
        self.assertFalse((private/'selfie.jpg').exists())

    def test_identity_file_checks_and_path_confinement(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)
            folder=path/'private_kyc';folder.mkdir()
            jpeg=b'\xff\xd8'+b'x'*128+b'\xff\xd9'
            for file in ('front.jpg','back.jpg','selfie.jpg'):
                (folder/file).write_bytes(jpeg)
            with patch.object(app,'ROOT',path):
                photos=app.kyc_files(self.meta)
                self.assertEqual(set(photos),{'idFrontPath','idBackPath','selfiePath'})
                (folder/'back.jpg').write_bytes(b'invalid')
                with self.assertRaises(app.ToolError):app.kyc_files(self.meta)
                dangerous={**self.meta,'operatorIdentity':{**self.meta['operatorIdentity'],
                           'selfiePath':'private_kyc/../../outside.jpg'}}
                with self.assertRaises(app.ToolError):app.kyc_files(dangerous)

    def test_kyc_refuses_other_account(self):
        with self.assertRaisesRegex(app.ToolError,'account khác'):
            app.submit_primary_kyc(self.meta,self.meta['accounts'][1],{'accounts':{}},live=True)

    def test_kyc_calls_authoritative_backend_for_primary_only(self):
        calls=[]
        def fake_api(base,path,data,*,token=None,method='POST'):
            calls.append((path,data,token))
            if path=='identity-access/auth/password':
                return {'userId':'user-a','accessToken':'session-a'}
            if path=='identity-verification/auto-check':
                return {'state':'AUTO_CHECK_PASSED','assurance':'FACE_SIMILARITY_ONLY'}
            raise AssertionError(path)
        account={**self.meta['accounts'][0],'registration':{**self.meta['accounts'][0]['registration'],
                        'email':'owner-a@domain.vn','fullName':'Chủ tài khoản thật','phone':'0900000001'}}
        state={'accounts':{'owner_a':{'userId':'user-a','email':'owner-a@domain.vn'}},'imported':{}}
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);folder=root/'private_kyc';folder.mkdir()
            jpg=b'\xff\xd8'+b'1'*100+b'\xff\xd9'
            for file in ('front.jpg','back.jpg','selfie.jpg'):(folder/file).write_bytes(jpg)
            with patch.object(app,'ROOT',root), patch.object(app,'base_url',return_value='https://backend.example'), \
                 patch.object(app,'api_request',side_effect=fake_api), \
                 patch('builtins.input',return_value='CONSENT OWNER_A'), \
                 patch.dict('os.environ',{'TROOI_OWNER_A_PASSWORD':'correct-private-password'}):
                result=app.submit_primary_kyc(self.meta,account,state,live=True)
        self.assertEqual(result,{'state':'AUTO_CHECK_PASSED','assurance':'FACE_SIMILARITY_ONLY'})
        self.assertEqual(len(calls),2)
        self.assertEqual(calls[0][0],'identity-access/auth/password')
        self.assertEqual(calls[1][0],'identity-verification/auto-check')
        self.assertEqual(calls[1][2],'session-a')
        self.assertEqual(calls[1][1]['consentVersion'],'kyc-auto-v1')
        self.assertEqual(calls[1][1]['frontImageBase64'],__import__('base64').b64encode(jpg).decode('ascii'))
        self.assertEqual(state['accounts']['owner_a']['userId'],'user-a')
        self.assertNotIn('identityChecks',state)

    def test_kyc_refuses_session_cross_account(self):
        account={**self.meta['accounts'][0],'registration':{**self.meta['accounts'][0]['registration'],
                           'email':'owner-a@domain.vn'}}
        state={'accounts':{'owner_a':{'userId':'user-a','email':'owner-a@domain.vn'}}}
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);folder=root/'private_kyc';folder.mkdir()
            for file in ('front.jpg','back.jpg','selfie.jpg'):
                (folder/file).write_bytes(b'\xff\xd8'+b'x'*100+b'\xff\xd9')
            with patch.object(app,'ROOT',root), patch.object(app,'base_url',return_value='https://backend.example'), \
                 patch.object(app,'api_request',return_value={'userId':'user-b','accessToken':'mismatched'}), \
                 patch('builtins.input',return_value='CONSENT OWNER_A'), \
                 patch.dict('os.environ',{'TROOI_OWNER_A_PASSWORD':'correct-private-password'}):
                with self.assertRaisesRegex(app.ToolError,'userId không khớp'):
                    app.submit_primary_kyc(self.meta,account,state,live=True)

if __name__=='__main__':unittest.main()
