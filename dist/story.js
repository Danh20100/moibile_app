import * as T from './three.module.js';
import { stops, sceneState } from './timeline.js';
const host=document.querySelector('#stage'), chapters=[...document.querySelectorAll('.chapter')], links=[...document.querySelectorAll('.chapter-nav a')];
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x)},lerp=(a,b,t)=>a+(b-a)*t;
let paused=matchMedia('(prefers-reduced-motion: reduce)').matches,position=0,target=0,active=0;
const motion=document.querySelector('#motion');function motionLabel(){motion.setAttribute('aria-pressed',String(paused));motion.innerHTML=paused?'Bật chuyển động <span>▷</span>':'Tạm dừng chuyển động <span>Ⅱ</span>'}motionLabel();motion.onclick=()=>{paused=!paused;motionLabel()};
const labels=['MỘT THÀNH PHỐ. NGÀN KHỞI ĐẦU.','KHÔNG GIAN CỦA RIÊNG BẠN.','RÕ RÀNG TỪNG KHOẢN CHI.','Ở TRỌ, CÓ NHAU.','MỘT ỨNG DỤNG. CẢ HÀNH TRÌNH.'];
function getScroll(){
  target=clamp(scrollY/chapters[1].offsetTop,0,4.4);
  const idx=target<.8?0:target<1.8?1:target<2.93?2:target<3.88?3:4;
  active=idx;
  chapters.forEach((s,i)=>{s.querySelector('.copy').style.opacity=i===idx?1:0;s.querySelector('.copy').style.visibility=i===idx?'visible':'hidden'});
  links.forEach((a,i)=>{a.classList.toggle('active',i===idx);if(i===idx)a.setAttribute('aria-current','step');else a.removeAttribute('aria-current')});
  document.querySelector('#scene-number').textContent=`0${idx+1} / 05`;
  document.querySelector('#scene-label').textContent=labels[idx];
}
function goToChapter(id,behavior='smooth'){
  const index=chapters.findIndex(s=>s.id===id);if(index<0)return;
  const y=stops[index]*chapters[1].offsetTop;
  scrollTo({top:y,behavior:paused?'instant':behavior});
}
document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{
  const id=a.getAttribute('href').slice(1);if(!chapters.some(s=>s.id===id))return;
  e.preventDefault();history.pushState(null,'','#'+id);goToChapter(id);
}));
addEventListener('popstate',()=>goToChapter(location.hash.slice(1)||'start'));
addEventListener('scroll',getScroll,{passive:true});getScroll();
if(location.hash)requestAnimationFrame(()=>goToChapter(location.hash.slice(1),'instant'));
try{init()}catch(e){console.error(e);document.querySelector('#load-error').hidden=false}
function init(){
const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setClearColor(0xeef3e9,0);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;host.appendChild(renderer.domElement);
const scene=new T.Scene(),camera=new T.PerspectiveCamera(36,1,.1,160);camera.position.set(16,15,21);camera.lookAt(0,0,0);scene.add(new T.HemisphereLight(0xffffff,0x6d8255,3));const sun=new T.DirectionalLight(0xfff6db,5);sun.position.set(-8,19,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-22,right:22,top:22,bottom:-22,near:.5,far:60});sun.shadow.normalBias=.04;sun.shadow.bias=-.0003;scene.add(sun);const fill=new T.DirectionalLight(0xd8f5ff,2);fill.position.set(10,8,-8);scene.add(fill);
const mat=(c,r=.65)=>new T.MeshStandardMaterial({color:c,roughness:r});const palette={white:mat(0xf9f7e9),cream:mat(0xe8e7cd),green:mat(0xa5be72),dark:mat(0x284839),lime:mat(0xd7f57b),glass:mat(0x75aaa5,.25),wood:mat(0xbca27c),clay:mat(0xc28b67),grey:mat(0x82928b),skin:mat(0xe3b78e),blue:mat(0x718eaa),black:mat(0x172c25)};
const boxGeo=new T.BoxGeometry(1,1,1);function box(g,w,h,d,x,y,z,m=palette.white){const o=new T.Mesh(boxGeo,m);o.scale.set(w,h,d);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o}function sphere(g,r,x,y,z,m){const o=new T.Mesh(new T.SphereGeometry(r,16,12),m);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o}function cylinder(g,rt,rb,h,x,y,z,m){let o=new T.Mesh(new T.CylinderGeometry(rt,rb,h,14),m);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o}function group(parent){let o=new T.Group();parent.add(o);return o}
const world=group(scene),city=group(world),room=group(world),transaction=group(world),care=group(world),end=group(world);city.rotation.y=-.15;
const wave=(x,z,t)=>Math.sin(x*.35+t*.5)*.48+Math.cos(z*.42+t*.4)*.38+Math.sin((x+z)*.25+t*.3)*.25;
const terrainGeo=new T.PlaneGeometry(24,21,64,56);terrainGeo.rotateX(-Math.PI/2);const terrain=new T.Mesh(terrainGeo,mat(0xc4d5a8));terrain.receiveShadow=true;city.add(terrain);let terrainPosition=terrainGeo.attributes.position;
const gridVertices=[];for(let x=-12;x<=12;x+=1){for(let z=-10.5;z<10.5;z+=.5)gridVertices.push(x,0,z,x,0,z+.5)}for(let z=-10.5;z<=10.5;z+=1){for(let x=-12;x<12;x+=.5)gridVertices.push(x,0,z,x+.5,0,z)}const gridGeo=new T.BufferGeometry();gridGeo.setAttribute('position',new T.Float32BufferAttribute(gridVertices,3));const grid=new T.LineSegments(gridGeo,new T.LineBasicMaterial({color:0x8fa571,transparent:true,opacity:.48}));city.add(grid);
const roads=[];for(const [x,z,w,d]of [[0,0,24,.38],[-3,0,.42,21],[5,0,.36,21],[0,-5,24,.36],[0,5,24,.36]]){let geo=new T.PlaneGeometry(w,d,w>1?64:1,d>1?64:1);geo.rotateX(-Math.PI/2);geo.translate(x,0,z);const mesh=new T.Mesh(geo,mat(0xe4e9d2));city.add(mesh);roads.push(mesh)}
const buildings=[];let seed=312;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
const facades=[mat(0xead3ad),mat(0xc2d5ca),mat(0xd9b69b),mat(0xe5e6cc),mat(0xa9c5ca)];
const roofColors=[mat(0x657950),mat(0xa56a50),mat(0x536e76)];
const windowMat=mat(0x315a62,.23),warmWindow=mat(0xf1ce83,.4);
function building(x,z,i){
 const b=group(city),tall=i%3===0,w=tall?1.45:1.15,d=tall?1.35:1.15;
 const h=tall?2.65+rand()*1.25:1.1+rand()*.45;
 box(b,w,h,d,0,h/2,0,facades[i%facades.length]);
 function windowOn(face,u,y,lit){
   const frame=group(b);frame.position.set(face<2?u:(face===2?w/2+.025:-w/2-.025),y,face<2?(face===0?d/2+.025:-d/2-.025):u);
   frame.rotation.y=[0,Math.PI,Math.PI/2,-Math.PI/2][face];
   box(frame,.32,.4,.055,0,0,0,palette.white);
   box(frame,.255,.32,.025,0,0,.037,lit?warmWindow:windowMat);
   box(frame,.025,.33,.018,0,0,.055,palette.cream);
   box(frame,.38,.055,.14,0,-.22,.02,palette.cream);
 }
 if(tall){
   box(b,w+.18,.14,d+.18,0,h+.04,0,palette.white);
   box(b,.45,.3,.4,.28,h+.25,-.2,palette.grey);
   for(let y=.85;y<h-.2;y+=.56){
     for(let face=0;face<4;face++)for(let u of [-.37,.37])windowOn(face,u,y,(i+face+Math.round(y*10))%5===0);
     box(b,w+.08,.05,d+.08,0,y-.29,0,palette.cream);
   }
   box(b,.62,.64,.055,0,.34,d/2+.03,windowMat);
   box(b,.04,.64,.035,0,.34,d/2+.07,palette.white);
   box(b,.95,.09,.4,0,.74,d/2+.12,palette.dark);
 }else{
   // Extruded gable: the ridge is explicitly above the eaves, never rotated.
   const half=w/2+.14,rise=.48,depth=d+.28,shape=new T.Shape();
   shape.moveTo(-half,0);shape.lineTo(half,0);shape.lineTo(0,rise);shape.closePath();
   const geo=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false});geo.translate(0,h,-depth/2);
   const roof=new T.Mesh(geo,roofColors[i%3]);roof.castShadow=true;roof.receiveShadow=true;b.add(roof);
   const pitch=Math.atan2(rise,half),length=Math.hypot(rise,half);
   for(let sign of [-1,1]){const panel=box(b,length,.065,depth+.05,sign*half/2,h+rise/2+.015,0,roofColors[i%3]);panel.rotation.z=-sign*pitch;}
   box(b,.3,.65,.065,.25,.34,d/2+.04,palette.wood);
   sphere(b,.025,.34,.33,d/2+.083,palette.dark);
   windowOn(0,-.28,.73,i%3===0);windowOn(1,0,.72,false);
   for(let face of [2,3])windowOn(face,0,.72,i%4===0);
   box(b,.46,.06,.25,.25,.05,d/2+.12,palette.cream);
 }
 box(b,w+.2,.1,d+.2,0,.015,0,palette.cream);
 b.position.set(x,0,z);buildings.push({b,x,z,phase:rand()*Math.PI*2,speed:.3+rand()*.35});return b;
}
for(let i=0;i<47;i++){let x=(i%8-3.5)*2.6+.6,z=(Math.floor(i/8)-2.5)*3.15+.9;if(Math.abs(x+3)<.9)x+=1;if(Math.abs(x-5)<.9)x+=1.2;if(Math.abs(z)<.8)z+=1.3;building(x,z,i)}
const trees=[];for(let i=0;i<40;i++){const g=group(city),x=(rand()-.5)*23,z=(rand()-.5)*19;cylinder(g,.065,.08,.6,0,.3,0,palette.wood);sphere(g,.33,0,.85,0,i%2?palette.green:palette.dark);g.position.set(x,0,z);trees.push({g,x,z})}
function ring(parent,r,x,y,z){const o=new T.Mesh(new T.TorusGeometry(r,.045,10,60),palette.lime);o.rotation.x=-Math.PI/2;o.position.set(x,y,z);parent.add(o);return o}const locator=group(city);ring(locator,.85,0,0,0);ring(locator,1.13,0,.01,0);locator.position.set(1,.7,2);
// An open architectural room; furnishings are independent 3D objects.
function roomShell(parent){box(parent,7.5,.28,6.4,0,-.14,0,palette.wood);for(let x=-3.5;x<3.8;x+=.5)box(parent,.012,.007,6.25,x,.007,0,palette.cream);box(parent,7.5,3.8,.18,0,1.9,-3.1,palette.cream);box(parent,.18,3.8,6.4,-3.65,1.9,0,palette.white);box(parent,7.3,.12,.13,0,.07,-2.96,palette.white);box(parent,.13,.12,6,-3.53,.07,0,palette.white);const win=group(parent);win.position.set(-3.53,2,-.4);box(win,.05,1.85,2.5,0,0,0,palette.glass);for(let z of [-1.3,0,1.3])box(win,.1,2,.08,.06,0,z,palette.white);for(let y of [-1,1])box(win,.13,.09,2.7,.06,y,0,palette.white);box(win,.38,.1,2.9,.12,-1.04,0,palette.white);for(let i=0;i<5;i++)box(parent,.75,.006,1.4,-2+i*.82,.025,-.2+i*.3,mat(0xd9cc9b));return win}
roomShell(room);const furnishings=[];function furnishing(x,y,z,fn){const g=group(room);g.position.set(x,y,z);fn(g);furnishings.push({g,home:new T.Vector3(x,y,z),offset:new T.Vector3((rand()-.5)*17,4+rand()*7,(rand()-.5)*14),rotation:(rand()-.5)*3});return g}
furnishing(1.8,0,-1.4,g=>{box(g,2.6,.42,3.4,0,.35,0,palette.wood);box(g,2.55,.35,3.3,0,.73,0,palette.white);box(g,2.58,.15,2.2,0,.97,.53,palette.green);box(g,2.65,1.5,.15,0,.8,-1.66,palette.wood);for(let x of [-.66,.66]){let p=box(g,1.05,.23,.62,x,1,-1.06,palette.cream);p.rotation.y=x*.12}for(let i=0;i<8;i++)box(g,.018,.02,2.1,-1.12+i*.32,1.052,.57,palette.lime)});
furnishing(-2.25,0,-1.45,g=>{box(g,1.65,.13,1.1,0,1.35,0,palette.wood);for(let x of [-.68,.68])for(let z of [-.42,.42])box(g,.085,1.3,.085,x,.65,z,palette.dark);box(g,.62,.035,.42,0,1.44,.1,palette.grey);let laptop=box(g,.62,.42,.035,0,1.65,-.1,palette.dark);laptop.rotation.x=-.2;box(g,.55,.32,.015,0,1.66,-.067,palette.glass);cylinder(g,.13,.13,.17,.57,1.5,.2,palette.white)});
furnishing(-2.1,0,.05,g=>{box(g,.78,.15,.75,0,.8,0,palette.green);box(g,.78,.72,.12,0,1.18,.33,palette.green);for(let x of [-.3,.3])for(let z of [-.26,.26])box(g,.07,.75,.07,x,.38,z,palette.wood)});
furnishing(.1,.04,1.35,g=>{box(g,4.4,.035,1.75,0,0,0,palette.cream);for(let i=0;i<12;i++)box(g,.022,.008,1.7,-2+i*.36,.022,0,palette.green)});
furnishing(2.7,0,2,g=>{cylinder(g,.39,.29,.63,0,.32,0,palette.clay);for(let i=0;i<7;i++){let a=i*2.4;const leaf=sphere(g,.28,Math.cos(a)*.3,.85+(i%3)*.24,Math.sin(a)*.3,palette.green);leaf.scale.set(.5,1.9,.75)}});
furnishing(.1,0,-2.65,g=>{box(g,.85,.72,.65,0,.36,0,palette.wood);cylinder(g,.035,.035,.67,0,1.08,0,palette.dark);cylinder(g,.23,.37,.4,0,1.55,0,palette.lime)});
const picture=group(room);box(picture,1.3,1.05,.08,.1,2.45,-2.95,palette.wood);box(picture,1.15,.9,.02,.1,2.45,-2.9,palette.white);const art=sphere(picture,.3,.12,2.46,-2.87,palette.green);art.scale.z=.05;
// Canvas textures contain document and phone UI, mapped onto real 3D surfaces.
function texture(w,h,draw){let c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);let tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;return tx}
function write(ctx,s,x,y,size=28,color='#263c2c',weight=500){ctx.fillStyle=color;ctx.font=`${weight} ${size}px Arial`;ctx.fillText(s,x,y)}
const receiptTex=texture(600,800,(c,w,h)=>{c.fillStyle='#fffdf3';c.fillRect(0,0,w,h);write(c,'trọơi',45,76,45,'#32543b',800);write(c,'HÓA ĐƠN THUÊ NHÀ',45,150,27,'#263c2c',700);write(c,'PHÒNG 203 · THÁNG 09',45,191,18,'#7b8975');c.fillStyle='#dae1cf';c.fillRect(45,221,510,2);[['Tiền phòng','3.000.000 đ'],['Tiền điện','180.000 đ'],['Tiền nước','70.000 đ']].forEach(([a,b],i)=>{write(c,a,45,283+i*69,24);write(c,b,350,283+i*69,24)});c.fillStyle='#dae1cf';c.fillRect(45,463,510,2);write(c,'TỔNG CỘNG',45,499,21);write(c,'3.250.000 đ',45,547,43,'#32543b',700);write(c,'Minh họa trải nghiệm Trọ Ơi',45,748,17,'#88907e')});
const receipt=group(transaction);const paper=new T.Mesh(new T.PlaneGeometry(3.15,4.2,16,20),new T.MeshStandardMaterial({map:receiptTex,side:T.DoubleSide,roughness:.85}));paper.castShadow=true;receipt.add(paper);const paperBase=paper.geometry.attributes.position.array.slice();
const stamp=group(receipt);const stampBody=group(stamp);box(stampBody,2.38,.18,.86,0,0,0,palette.dark);cylinder(stampBody,.21,.25,.57,0,.36,0,palette.wood);sphere(stampBody,.29,0,.72,0,palette.wood);stampBody.rotation.x=Math.PI/2;
const sealTex=texture(500,200,(c)=>{c.strokeStyle='#3f7651';c.lineWidth=7;c.strokeRect(12,12,476,176);write(c,'ĐÃ THANH TOÁN',32,94,40,'#3f7651',700);write(c,'TRỌ ƠI · MINH HỌA',90,149,24,'#3f7651',600)});const seal=new T.Mesh(new T.PlaneGeometry(2.38,.86),new T.MeshBasicMaterial({map:sealTex,transparent:true,depthWrite:false}));seal.position.set(0,-1.28,.015);seal.rotation.z=-.06;receipt.add(seal);
const phoneTex=texture(600,1100,(c,w,h)=>{c.fillStyle='#f1f5e9';c.fillRect(0,0,w,h);write(c,'9:41',42,56,23);write(c,'trọơi',45,150,55,'#32543b',800);write(c,'Chào bạn, về nhà thôi.',45,210,28);c.fillStyle='#d8ecb6';c.beginPath();c.roundRect(35,265,530,258,26);c.fill();write(c,'GÓC RIÊNG CỦA BẠN',62,312,19);write(c,'Phòng 203',62,378,45,'#32543b',700);write(c,'Một nơi ở. Cả một khởi đầu.',62,428,22);write(c,'Đang thuê',62,479,22,'#627d41');write(c,'Tháng này nhẹ lòng rồi.',45,588,29,'#32543b',600);c.fillStyle='#fff';c.beginPath();c.roundRect(35,628,530,172,22);c.fill();write(c,'Hóa đơn tháng 09',62,676,25);write(c,'3.250.000 đ',62,728,36,'#32543b',700);write(c,'✓ Đã thanh toán',62,771,22,'#628637');c.fillStyle='#2f4b36';c.beginPath();c.roundRect(35,843,530,83,40);c.fill();write(c,'Báo sự cố / Yêu cầu hỗ trợ',76,895,26,'#e0f0c7');write(c,'Trang chủ       Phòng của tôi       Cá nhân',42,1027,21);});
function makePhone(parent,display=phoneTex){let p=group(parent);
const w=2.74,h=4.85,r=.24,shape=new T.Shape();
shape.moveTo(-w/2+r,-h/2);shape.lineTo(w/2-r,-h/2);shape.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);shape.lineTo(w/2,h/2-r);shape.quadraticCurveTo(w/2,h/2,w/2-r,h/2);shape.lineTo(-w/2+r,h/2);shape.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);shape.lineTo(-w/2,-h/2+r);shape.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
const shellGeo=new T.ExtrudeGeometry(shape,{depth:.28,bevelEnabled:false,curveSegments:12});shellGeo.translate(0,0,-.14);const shell=new T.Mesh(shellGeo,palette.dark);shell.castShadow=true;p.add(shell);
let screen=new T.Mesh(new T.PlaneGeometry(2.43,4.47),new T.MeshBasicMaterial({map:display}));screen.position.z=.153;p.add(screen);box(p,.65,.1,.025,0,2.13,.17,palette.black);box(p,.6,.045,.025,0,-2.11,.17,palette.white);return p}const phone=makePhone(transaction);
// Tenant walk is an articulated animation, followed by the service scene.
function capsule(parent,radius,length,x,y,z,material){
 const mesh=new T.Mesh(new T.CapsuleGeometry(radius,Math.max(.01,length-2*radius),5,12),material);
 mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;
}
function person(parent,shirt){
 const g=group(parent);const torso=capsule(g,.32,1.02,0,1.65,0,shirt);torso.scale.z=.68;
 cylinder(g,.1,.12,.19,0,2.21,0,palette.skin);sphere(g,.285,0,2.47,0,palette.skin);
 const hair=sphere(g,.29,0,2.59,-.015,palette.dark);hair.scale.y=.6;
 sphere(g,.065,0,2.45,.276,palette.skin);
 for(let x of [-.095,.095])sphere(g,.018,x,2.51,.267,palette.dark);
 const legs=[],knees=[],arms=[],elbows=[];
 for(let side of [-1,1]){
   const leg=group(g);leg.position.set(side*.18,1.22,0);
   capsule(leg,.12,.54,0,-.24,0,palette.dark);
   const knee=group(leg);knee.position.y=-.49;sphere(leg,.115,0,-.49,0,palette.dark);
   capsule(knee,.105,.55,0,-.25,0,palette.dark);box(knee,.23,.13,.37,0,-.52,.065,palette.cream);
   legs.push(leg);knees.push(knee);
   const arm=group(g);arm.position.set(side*.36,2.02,0);
   sphere(arm,.135,0,0,0,shirt);capsule(arm,.115,.44,0,-.2,0,shirt);
   const elbow=group(arm);elbow.position.y=-.4;sphere(arm,.096,0,-.4,0,palette.skin);
   capsule(elbow,.085,.38,0,-.17,0,palette.skin);sphere(elbow,.093,0,-.39,0,palette.skin);
   arms.push(arm);elbows.push(elbow);
 }
 return{g,legs,knees,arms,elbows};
}
const tenant=person(world,palette.green);
// Luggage follows the left wrist instead of intersecting a rigid upper arm.
const bag=group(tenant.elbows[0]);bag.position.set(-.08,-.5,0);
box(bag,.38,.5,.28,0,-.28,0,palette.wood);box(bag,.23,.045,.055,0,0,0,palette.dark);
for(let x of [-.1,.1])box(bag,.035,.14,.055,x,-.065,0,palette.dark);
const heldPhone=group(tenant.elbows[1]);box(heldPhone,.19,.32,.045,0,-.34,.09,palette.dark);box(heldPhone,.155,.26,.014,0,-.34,.12,palette.lime);
roomShell(care);const ac=group(care);ac.position.set(.8,2.9,-2.88);box(ac,2.45,.72,.43,0,0,0,palette.white);box(ac,2.2,.16,.07,0,-.2,.25,palette.dark);for(let i=0;i<4;i++)box(ac,2.18,.016,.08,0,-.24+i*.037,.3,palette.cream);sphere(ac,.025,.92,.13,.24,palette.green);
const ladder=group(care);ladder.position.set(.85,0,-1.7);for(let x of [-.52,.52]){let rail=box(ladder,.08,2.65,.09,x,1.29,0,palette.wood);rail.rotation.x=-.1;let back=box(ladder,.08,2.65,.09,x,1.29,-.77,palette.wood);back.rotation.x=.4}for(let y=.25;y<2.6;y+=.4)box(ladder,1.12,.08,.14,0,y,.14-y*.1,palette.cream);
const worker=person(care,palette.blue);worker.g.position.set(.8,.62,-1.3);worker.g.scale.setScalar(.82);worker.g.rotation.y=Math.PI;worker.arms[0].rotation.x=-2.05;worker.arms[1].rotation.x=-1.7;worker.elbows[0].rotation.x=-.45;worker.elbows[1].rotation.x=-.7;worker.legs[0].rotation.x=.2;cylinder(worker.g,.33,.33,.1,0,2.67,0,palette.lime);box(care,.85,.48,.58,2.1,.25,.3,palette.dark);box(care,.38,.1,.12,2.1,.55,.3,palette.grey);const air=[];for(let i=0;i<5;i++){let line=box(care,.023,.023,.8,-.1+i*.43,2.6,-2.2,palette.glass);air.push(line)}const downloadTex=texture(600,1100,(c,w,h)=>{
 c.fillStyle='#eef3e9';c.fillRect(0,0,w,h);write(c,'9:41',42,56,23);
 write(c,'trọơi',64,245,105,'#32543b',800);write(c,'Tìm được trọ.',64,348,38,'#32543b',600);write(c,'Chạm được nhà.',64,401,38,'#739344',600);
 write(c,'Hẹn gặp bạn trên',64,530,28,'#64735c');
 for(const [name,y] of [['Google Play',585],['App Store',758]]){
 c.fillStyle='#233d2c';c.beginPath();c.roundRect(53,y,494,137,22);c.fill();
 write(c,'SẮP RA MẮT TRÊN',83,y+40,19,'#d6edb6');write(c,name,83,y+95,43,'#ffffff',600);
 }
 write(c,'Một ứng dụng. Cả hành trình.',64,998,25,'#64735c');
});const endPhone=makePhone(end,downloadTex);endPhone.position.y=2.4;

const halo=new T.Mesh(new T.TorusGeometry(3.65,.015,8,100),palette.green);halo.position.set(0,2.4,-.4);end.add(halo);const halo2=halo.clone();halo2.scale.setScalar(1.18);halo2.rotation.y=.3;end.add(halo2);
function resize(){renderer.setSize(host.clientWidth,host.clientHeight,false);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();getScroll()}addEventListener('resize',resize);resize();
let time=0,last=performance.now();const look=new T.Vector3(),camGoal=new T.Vector3();
function render(now){requestAnimationFrame(render);if(document.hidden){last=now;return}const dt=Math.min((now-last)/1000,.05);last=now;if(!paused)time+=dt;position=paused?target:lerp(position,target,1-Math.exp(-dt*7));const p=position;
const state=sceneState(p);city.visible=state.city;room.visible=state.room;transaction.visible=state.transaction;care.visible=state.care;end.visible=state.end;tenant.g.visible=state.tenant;
const t=paused?0:time;
if(city.visible){for(let i=0;i<terrainPosition.count;i++){const x=terrainPosition.getX(i),z=terrainPosition.getZ(i);terrainPosition.setY(i,wave(x,z,t))}terrainPosition.needsUpdate=true;terrainGeo.computeVertexNormals();const gp=gridGeo.attributes.position;for(let i=0;i<gp.count;i++)gp.setY(i,wave(gp.getX(i),gp.getZ(i),t)+.016);gp.needsUpdate=true;roads.forEach(r=>{let a=r.geometry.attributes.position;for(let i=0;i<a.count;i++)a.setY(i,wave(a.getX(i),a.getZ(i),t)+.026);a.needsUpdate=true});buildings.forEach(({b,x,z,phase,speed},i)=>{let v=paused?.85:smooth((Math.sin(t*speed+phase)+.5)/1.1);b.scale.y=Math.max(.001,v);b.scale.x=b.scale.z=.85+.15*v;b.position.y=wave(x,z,t)-.2*(1-v)});trees.forEach(({g,x,z})=>g.position.y=wave(x,z,t));locator.position.y=wave(1,2,t)+.12;locator.scale.setScalar(1+Math.sin(t*2)*.08);const c=smooth((p-.56)/.58);city.scale.setScalar(lerp(1,3.6,c));city.position.y=lerp(-.7,-19,c);city.rotation.y=-.15+t*.015*(1-c)}
const roomIn=smooth((p-.72)/.42),roomOut=smooth((p-1.76)/.34);room.scale.setScalar(lerp(.05,1,roomIn)*(1-roomOut*.22));room.position.set(0,lerp(-3,0,roomIn)-roomOut*15,-roomOut*15);room.rotation.y=lerp(-.25,.04,roomIn);
furnishings.forEach(({g,home,offset,rotation},i)=>{let a=smooth((p-.87-i*.025)/.43);g.position.copy(home).addScaledVector(offset,1-a);g.rotation.set(rotation*(1-a),rotation*(1-a),rotation*.4*(1-a))});
const receiptIn=smooth((p-1.74)/.35),stampDown=smooth((p-2.10)/.14),stampUp=smooth((p-2.3)/.15),intoPhone=smooth((p-2.66)/.23);transaction.position.set(0,0,0);receipt.position.set(lerp(-7,.1,receiptIn)+intoPhone*2,lerp(4,2.75,receiptIn)-intoPhone*.25,lerp(-5,2.6,receiptIn)-intoPhone*2);receipt.rotation.set(lerp(.8,-.04,receiptIn),lerp(1.2,.35,receiptIn),lerp(-1,.07,receiptIn)+intoPhone*.8);receipt.scale.setScalar((.7+.3*receiptIn)*(1-intoPhone*.98));receipt.visible=intoPhone<.99;let arr=paper.geometry.attributes.position;for(let i=0;i<arr.count;i++)arr.setZ(i,paperBase[i*3+2]+Math.sin(paperBase[i*3+1]*3+t*4)*.13*(1-receiptIn));arr.needsUpdate=true;seal.visible=stampDown>.98;stamp.visible=p>2.05&&p<2.48;stamp.position.set(seal.position.x,seal.position.y,seal.position.z+.09+lerp(4,0,stampDown)+stampUp*4);stamp.rotation.set(0,0,seal.rotation.z);phone.position.set(lerp(4,1.2,intoPhone),2.5,0);phone.rotation.set(-.06,.4,-.07);phone.scale.setScalar(.78);transaction.scale.setScalar(1-smooth((p-2.92)/.17));
// Briefly check the phone, then walk across to reveal the service visit.
const walk=smooth((p-2.94)/.53),check=smooth((p-2.86)/.08)*(1-smooth((p-2.97)/.1));
tenant.g.position.set(lerp(-8,12,walk),-.14,6.5);tenant.g.scale.setScalar(1.6);
tenant.g.rotation.y=lerp(.3,Math.PI/2,1-check);tenant.g.rotation.z=Math.sin(walk*32)*.015;
tenant.legs.forEach((leg,i)=>{const gait=Math.sin(walk*32+i*Math.PI);leg.rotation.x=gait*.42;tenant.knees[i].rotation.x=Math.max(0,-gait)*.62;});
tenant.arms[0].rotation.x=-Math.sin(walk*32)*.17;tenant.elbows[0].rotation.x=-.12;
tenant.arms[1].rotation.x=Math.sin(walk*32)*.3-check*.75;tenant.elbows[1].rotation.x=-.25-check*.95;
tenant.g.position.y+=Math.abs(Math.sin(walk*32))*.035;
care.scale.setScalar(lerp(.88,1,smooth((p-3.02)/.28)));
care.position.y=-(1-smooth((p-3.02)/.28))*2-smooth((p-3.7)/.28)*17;care.rotation.y=.05;
worker.arms[0].rotation.z=Math.sin(t*2.5)*.045;worker.elbows[0].rotation.x=-.45+Math.sin(t*2.5)*.065;
air.forEach((a,i)=>{a.position.z=-2+((t*.7+i*.13)%1)*1.5;a.scale.z=.4+Math.sin(t+i)*.2});
end.scale.setScalar(smooth((p-3.9)/.26));endPhone.scale.setScalar(1.36);
endPhone.rotation.set(-.025,.12+Math.sin(t*.4)*.025,-.025);endPhone.position.y=2.45+Math.sin(t*.9)*.045;
halo.rotation.z=t*.04;halo2.rotation.z=-t*.03;
const zoom=smooth(p/.95);camGoal.set(lerp(18,11,zoom),lerp(17,9,zoom),lerp(24,16,zoom));let front=smooth((p-1.7)/.45)*(1-smooth((p-2.85)/.3));let finish=smooth((p-3.85)/.32);camGoal.lerp(new T.Vector3(6,6,17),front);camGoal.lerp(new T.Vector3(3.5,4.2,15.5),finish);camera.position.copy(camGoal);look.set(0,lerp(lerp(0,1.4,zoom),2.45,finish),0);camera.lookAt(look);renderer.render(scene,camera)}requestAnimationFrame(render);
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();document.querySelector('#load-error').hidden=false});
}
