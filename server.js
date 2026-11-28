const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const bcrypt = require('bcryptjs');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
// Render terminates HTTPS at its proxy; trust it so secure session cookies work.
app.set('trust proxy', 1);
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e6 });
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
// Use the configured directory when writable. On Render Free there is no
// persistent disk; if /var/data is unavailable, fall back to writable /tmp
// so the service can still boot (data in /tmp is ephemeral across restarts).
let DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
let UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
let DB_FILE = path.join(DATA_DIR, 'hyper.json');
try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, 'sessions'), { recursive: true });
  fs.accessSync(DATA_DIR, fs.constants.W_OK);
} catch (err) {
  console.warn('Configured DATA_DIR is not writable:', DATA_DIR, err.message);
  DATA_DIR = process.env.FREE_DATA_DIR || '/tmp/hyper-data';
  UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
  DB_FILE = path.join(DATA_DIR, 'hyper.json');
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, 'sessions'), { recursive: true });
  console.warn('Using temporary storage at', DATA_DIR, '- files and database may be lost when the service restarts or redeploys.');
}

const fresh = () => ({ users: [], posts: [], likes: [], comments: [], follows: [], stories: [], messages: [], reports: [], blocks: [], saves: [], storyLikes: [], storyComments: [], storySaves: [] });
let db;
try { db = fs.existsSync(DB_FILE) ? { ...fresh(), ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) } : fresh(); } catch { db = fresh(); }
for (const k of Object.keys(fresh())) if (!Array.isArray(db[k])) db[k] = [];
// Bootstrap the administrator from Render environment variables; never store a plaintext password in source code.
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '');
if (ADMIN_EMAIL && ADMIN_PASSWORD.length >= 12) {
  let admin = db.users.find(u => u.email === ADMIN_EMAIL);
  if (!admin) { admin = { id: crypto.randomBytes(12).toString('hex'), name: 'HYPER Admin', email: ADMIN_EMAIL, bio: 'Administrator', avatar: '', createdAt: new Date().toISOString() }; db.users.push(admin); }
  admin.role = 'admin'; admin.password = bcrypt.hashSync(ADMIN_PASSWORD, 12);
  fs.writeFileSync(DB_FILE, JSON.stringify(db));
} else if (ADMIN_EMAIL || ADMIN_PASSWORD) { console.warn('Admin bootstrap skipped: set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters).'); }
function save() { const tmp = DB_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DB_FILE); }
const id = () => crypto.randomBytes(12).toString('hex');
const clean = s => String(s || '').trim();
const publicUser = u => ({ id:u.id, name:u.name, email:u.email, role:u.role || 'user', bio:u.bio || '', avatar:u.avatar || '', createdAt:u.createdAt });
const getUser = req => db.users.find(u => u.id === req.session.userId && !u.suspended);
function auth(req,res,next) { const u=getUser(req); if(!u) return res.status(401).json({error:'Please log in first'}); req.user=u; next(); }
function adminOnly(req,res,next) { if(req.user?.role !== 'admin') return res.status(403).json({error:'Admin access only'}); next(); }
function blocked(a,b) { return db.blocks.some(x => (x.from===a&&x.to===b)||(x.from===b&&x.to===a)); }
const sessionMiddleware = session({ store:new FileStore({path:path.join(DATA_DIR,'sessions'),reapInterval:3600,ttl:30*86400}), secret:process.env.SESSION_SECRET || 'change-this-hyper-session-secret-before-production', resave:false, saveUninitialized:false, proxy:true,cookie:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:30*86400000} });
app.use(helmet({ contentSecurityPolicy:false }));
app.use(express.json({limit:'2mb'}));
app.use(sessionMiddleware);
app.use(rateLimit({windowMs:15*60*1000,limit:500,standardHeaders:true,legacyHeaders:false}));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge:'1d', immutable:false }));
app.get('/', (req,res)=>res.sendFile(path.join(ROOT,'index.html')));
app.get('/index.html', (req,res)=>res.sendFile(path.join(ROOT,'index.html')));
const ioSession = require('express-socket.io-session');
io.use(ioSession(sessionMiddleware, { autoSave:true }));

const storage = multer.diskStorage({ destination:(req,file,cb)=>cb(null,UPLOAD_DIR), filename:(req,file,cb)=>cb(null,Date.now()+'-'+crypto.randomBytes(5).toString('hex')+path.extname(file.originalname).toLowerCase()) });
const upload = multer({ storage, limits:{fileSize:100*1024*1024}, fileFilter:(req,file,cb)=>{
  const ext=path.extname(file.originalname).toLowerCase();
  const allowed=['.jpg','.jpeg','.png','.gif','.webp','.avif','.mp4','.m4v','.webm','.mov','.3gp','.mkv','.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.csv','.txt','.zip','.mp3','.m4a','.aac','.ogg','.wav'];
  const mediaExt=['.jpg','.jpeg','.png','.gif','.webp','.avif','.mp4','.m4v','.webm','.mov','.3gp','.mkv'];
  const ok=allowed.includes(ext) && (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/') || mediaExt.includes(ext) || /pdf|msword|officedocument|excel|powerpoint|zip|text\/|audio\//i.test(file.mimetype));
  cb(ok ? null : new Error('Unsupported file type. Choose JPG, PNG, MP4, MOV, WEBM or a document.'), ok);
}});

app.get('/health',(req,res)=>res.json({ok:true,app:'HYPER'}));
app.get('/api/me',(req,res)=>{ const u=getUser(req); res.json({user:u?publicUser(u):null}); });
app.get('/api/admin/overview',auth,adminOnly,(req,res)=>res.json({stats:{users:db.users.length,posts:db.posts.length,stories:db.stories.length,messages:db.messages.length,reports:db.reports.length},users:db.users.map(u=>({...publicUser(u),suspended:!!u.suspended}))}));
app.post('/api/admin/users/:id/suspend',auth,adminOnly,(req,res)=>{const u=db.users.find(x=>x.id===req.params.id);if(!u||u.id===req.user.id)return res.status(400).json({error:'Invalid user'});u.suspended=!u.suspended;save();res.json({suspended:u.suspended});});
app.delete('/api/posts/:id',auth,(req,res)=>{const p=db.posts.find(x=>x.id===req.params.id);if(!p)return res.status(404).json({error:'Post not found'});if(p.userId!==req.user.id&&req.user.role!=='admin')return res.status(403).json({error:'Only the post owner or admin can delete this post'});db.posts=db.posts.filter(x=>x.id!==p.id);db.likes=db.likes.filter(x=>x.postId!==p.id);db.saves=db.saves.filter(x=>x.postId!==p.id);db.comments=db.comments.filter(x=>x.postId!==p.id);save();res.json({ok:true});});
app.post('/api/register', async(req,res)=>{
 const name=clean(req.body.name).slice(0,40), email=clean(req.body.email).toLowerCase(), password=String(req.body.password||'');
 if(name.length<2 || !/^\S+@\S+\.\S+$/.test(email) || password.length<8) return res.status(400).json({error:'Name, valid email and password (8+ characters) are required'});
 if(db.users.some(u=>u.email===email)) return res.status(409).json({error:'Email already registered'});
 const u={id:id(),name,email,password:await bcrypt.hash(password,12),bio:'',avatar:'',createdAt:new Date().toISOString()}; db.users.push(u); save(); req.session.userId=u.id; res.json({user:publicUser(u)});
});
app.post('/api/login', async(req,res)=>{
 const email=clean(req.body.email).toLowerCase(), password=String(req.body.password||''); const u=db.users.find(x=>x.email===email);
 if(!u || !(await bcrypt.compare(password,u.password))) return res.status(401).json({error:'Email or password is incorrect'});
 if(u.suspended) return res.status(403).json({error:'Account is suspended'}); req.session.userId=u.id; res.json({user:publicUser(u)});
});
app.post('/api/logout',auth,(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get('/api/settings',auth,(req,res)=>res.json({hideLikes:!!req.user.hideLikes,blockedUsers:db.blocks.filter(x=>x.from===req.user.id).map(x=>publicUser(db.users.find(u=>u.id===x.to)).id)}));
app.put('/api/settings',auth,(req,res)=>{req.user.hideLikes=!!req.body.hideLikes;save();res.json({ok:true,hideLikes:req.user.hideLikes});});
app.get('/api/blocks',auth,(req,res)=>res.json({users:db.blocks.filter(x=>x.from===req.user.id).map(x=>db.users.find(u=>u.id===x.to)).filter(Boolean).map(publicUser)}));
app.post('/api/users/:id/block',auth,(req,res)=>{const target=req.params.id;if(target===req.user.id||!db.users.some(u=>u.id===target))return res.status(400).json({error:'Invalid user'});if(!db.blocks.some(x=>x.from===req.user.id&&x.to===target))db.blocks.push({from:req.user.id,to:target,createdAt:new Date().toISOString()});db.messages=db.messages.filter(m=>!((m.from===req.user.id&&m.to===target)||(m.from===target&&m.to===req.user.id)));save();res.json({blocked:true});});
app.delete('/api/users/:id/block',auth,(req,res)=>{db.blocks=db.blocks.filter(x=>!(x.from===req.user.id&&x.to===req.params.id));save();res.json({blocked:false});});
app.get('/api/feed',(req,res)=>{
 const me=getUser(req), type=clean(req.query.type), q=clean(req.query.q).toLowerCase();
 let posts=db.posts.filter(p=>{ const owner=db.users.find(u=>u.id===p.userId); return owner&&!owner.suspended&&(!me||!blocked(me.id,p.userId))&&(!type||p.type===type)&&(!q||(p.caption||'').toLowerCase().includes(q)||owner.name.toLowerCase().includes(q)); }).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100);
 res.json({posts:posts.map(p=>({...p,user:publicUser(db.users.find(u=>u.id===p.userId)),likes:db.likes.filter(x=>x.postId===p.id).length,comments:db.comments.filter(x=>x.postId===p.id).length,liked:!!me&&db.likes.some(x=>x.postId===p.id&&x.userId===me.id),saved:!!me&&db.saves.some(x=>x.postId===p.id&&x.userId===me.id),hideLikes:!!me&&!!me.hideLikes}))});
});
app.post('/api/posts',auth,upload.single('file'),(req,res)=>{
 const caption=clean(req.body.caption).slice(0,2000), file=req.file; const ext=file?path.extname(file.originalname).toLowerCase():''; const isVideo=!!file&&(file.mimetype.startsWith('video/')||['.mp4','.m4v','.webm','.mov','.3gp','.mkv'].includes(ext)); let type=file?(isVideo?(req.body.kind==='short'?'short':'video'):'image'):'text';
 if(req.body.kind==='short' && (!file || !isVideo)) return res.status(400).json({error:'A video file is required for a Short'});
 if(!caption&&!file) return res.status(400).json({error:'Write something or choose a photo/video'});
 const p={id:id(),userId:req.user.id,caption,type,file:file?'/uploads/'+file.filename:'',fileName:file?.originalname||'',mime:file?.mimetype||'',size:file?.size||0,createdAt:new Date().toISOString()}; db.posts.push(p); save(); res.json({post:p});
});
app.post('/api/posts/:id/like',auth,(req,res)=>{const p=db.posts.find(x=>x.id===req.params.id);if(!p)return res.status(404).json({error:'Post not found'});let i=db.likes.findIndex(x=>x.postId===p.id&&x.userId===req.user.id);if(i>=0)db.likes.splice(i,1);else db.likes.push({postId:p.id,userId:req.user.id});save();res.json({liked:i<0});});
app.post('/api/posts/:id/save',auth,(req,res)=>{const p=db.posts.find(x=>x.id===req.params.id);if(!p)return res.status(404).json({error:'Post not found'});const i=db.saves.findIndex(x=>x.postId===p.id&&x.userId===req.user.id);if(i>=0)db.saves.splice(i,1);else db.saves.push({postId:p.id,userId:req.user.id});save();res.json({saved:i<0});});
app.get('/api/posts/:id/comments',(req,res)=>{ const comments=db.comments.filter(c=>c.postId===req.params.id).map(c=>{ const u=db.users.find(x=>x.id===c.userId)||{id:'',name:'Deleted',email:''}; return {...c,user:publicUser(u)}; }); res.json({comments}); });
app.post('/api/posts/:id/comments',auth,(req,res)=>{const body=clean(req.body.body).slice(0,600);if(!body)return res.status(400).json({error:'Comment is empty'});db.comments.push({id:id(),postId:req.params.id,userId:req.user.id,body,createdAt:new Date().toISOString()});save();res.json({ok:true});});
app.get('/api/users/search',auth,(req,res)=>{const q=clean(req.query.q).toLowerCase();res.json({users:db.users.filter(u=>!u.suspended&&u.id!==req.user.id&&!blocked(u.id,req.user.id)&&u.name.toLowerCase().includes(q)).slice(0,40).map(publicUser)});});
app.get('/api/users/:id',(req,res)=>{const viewer=getUser(req);if(viewer&&blocked(viewer.id,req.params.id))return res.status(404).json({error:'User not found'});const u=db.users.find(x=>x.id===req.params.id&&!x.suspended);if(!u)return res.status(404).json({error:'User not found'});const posts=db.posts.filter(p=>p.userId===u.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));res.json({user:publicUser(u),posts,followers:db.follows.filter(x=>x.to===u.id).length,following:db.follows.filter(x=>x.from===u.id).length});});
app.post('/api/users/:id/follow',auth,(req,res)=>{const target=req.params.id;if(target===req.user.id||!db.users.some(u=>u.id===target)||blocked(target,req.user.id))return res.status(400).json({error:'Cannot follow this user'});const i=db.follows.findIndex(x=>x.from===req.user.id&&x.to===target);if(i>=0)db.follows.splice(i,1);else db.follows.push({from:req.user.id,to:target});save();res.json({following:i<0});});
app.put('/api/profile',auth,upload.single('avatar'),(req,res)=>{const name=clean(req.body.name).slice(0,40);if(name.length<2)return res.status(400).json({error:'Name must be at least 2 characters'});if(req.file&&!req.file.mimetype.startsWith('image/'))return res.status(400).json({error:'Profile photo must be an image'});req.user.name=name;req.user.bio=clean(req.body.bio).slice(0,240);if(req.file)req.user.avatar='/uploads/'+req.file.filename;save();res.json({ok:true,user:publicUser(req.user)});});
app.get('/api/stories',(req,res)=>{ const me=getUser(req); const now=Date.now(); db.stories=db.stories.filter(s=>new Date(s.expiresAt).getTime()>now); const stories=db.stories.filter(s=>!me||!blocked(me.id,s.userId)).map(s=>{ const u=db.users.find(x=>x.id===s.userId)||{id:'',name:'Unknown',email:''}; return {...s,user:publicUser(u)}; }); res.json({stories}); });
app.post('/api/stories',auth,upload.fields([{name:'file',maxCount:1},{name:'audio',maxCount:1}]),(req,res)=>{const body=clean(req.body.body).slice(0,180),file=req.files?.file?.[0],audio=req.files?.audio?.[0];if(!body&&!file)return res.status(400).json({error:'Write a story or choose a photo/video'});if(file&&!/^(image|video)\//.test(file.mimetype))return res.status(400).json({error:'Story attachment must be a photo or video'});if(audio&&!audio.mimetype.startsWith('audio/'))return res.status(400).json({error:'Choose an audio song file'});const story={id:id(),userId:req.user.id,body,file:file?'/uploads/'+file.filename:'',fileName:file?.originalname||'',mime:file?.mimetype||'',audio:audio?'/uploads/'+audio.filename:'',audioName:audio?.originalname||'',createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()};db.stories.push(story);save();res.json({ok:true,story});});
app.post('/api/stories/:id/like',auth,(req,res)=>{const s=db.stories.find(x=>x.id===req.params.id);if(!s)return res.status(404).json({error:'Story not found'});const i=db.storyLikes.findIndex(x=>x.storyId===s.id&&x.userId===req.user.id);if(i>=0)db.storyLikes.splice(i,1);else db.storyLikes.push({storyId:s.id,userId:req.user.id});save();res.json({liked:i<0});});
app.post('/api/stories/:id/save',auth,(req,res)=>{const s=db.stories.find(x=>x.id===req.params.id);if(!s)return res.status(404).json({error:'Story not found'});const i=db.storySaves.findIndex(x=>x.storyId===s.id&&x.userId===req.user.id);if(i>=0)db.storySaves.splice(i,1);else db.storySaves.push({storyId:s.id,userId:req.user.id});save();res.json({saved:i<0});});
app.get('/api/stories/:id/comments',(req,res)=>res.json({comments:db.storyComments.filter(x=>x.storyId===req.params.id).map(c=>({...c,user:publicUser(db.users.find(u=>u.id===c.userId)||{id:'',name:'Deleted',email:''})}))}));
app.post('/api/stories/:id/comments',auth,(req,res)=>{const body=clean(req.body.body).slice(0,400);if(!body)return res.status(400).json({error:'Comment is empty'});if(!db.stories.some(x=>x.id===req.params.id))return res.status(404).json({error:'Story not found'});db.storyComments.push({id:id(),storyId:req.params.id,userId:req.user.id,body,createdAt:new Date().toISOString()});save();res.json({ok:true});});
app.get('/api/contacts',auth,(req,res)=>{const ids=[...new Set([...db.follows.filter(x=>x.from===req.user.id).map(x=>x.to),...db.follows.filter(x=>x.to===req.user.id).map(x=>x.from),...db.messages.filter(m=>m.from===req.user.id||m.to===req.user.id).map(m=>m.from===req.user.id?m.to:m.from)])].filter(x=>x!==req.user.id&&!blocked(x,req.user.id));res.json({users:ids.map(x=>db.users.find(u=>u.id===x)).filter(Boolean).map(publicUser)});});
app.get('/api/messages/:id',auth,(req,res)=>{if(blocked(req.user.id,req.params.id))return res.status(403).json({error:'Chat unavailable'});res.json({messages:db.messages.filter(m=>(m.from===req.user.id&&m.to===req.params.id)||(m.from===req.params.id&&m.to===req.user.id)).slice(-200).map(m=>({...m,post:m.postId?db.posts.find(p=>p.id===m.postId)||null:null}))});});
app.post('/api/messages/:id/share',auth,(req,res)=>{const to=req.params.id,post=db.posts.find(p=>p.id===clean(req.body.postId));if(!db.users.some(u=>u.id===to)||blocked(req.user.id,to))return res.status(404).json({error:'User not found'});if(!post)return res.status(404).json({error:'Post not found'});const m={id:id(),from:req.user.id,to,body:post.caption||'Shared a post',type:'post',postId:post.id,createdAt:new Date().toISOString()};db.messages.push(m);save();const out={...m,post};io.to('user:'+to).emit('message',out);res.json({message:out});});
app.post('/api/messages/:id',auth,upload.single('file'),(req,res)=>{const to=req.params.id;if(!db.users.some(u=>u.id===to)||blocked(req.user.id,to))return res.status(404).json({error:'User not found'});const body=clean(req.body.body).slice(0,3000),f=req.file;if(!body&&!f)return res.status(400).json({error:'Message or attachment required'});const m={id:id(),from:req.user.id,to,body,type:f?(f.mimetype.startsWith('image/')?'image':f.mimetype.startsWith('video/')?'video':'file'):'text',url:f?'/uploads/'+f.filename:'',fileName:f?.originalname||'',mime:f?.mimetype||'',size:f?.size||0,createdAt:new Date().toISOString()};db.messages.push(m);save();io.to('user:'+to).emit('message',m);res.json({message:m});});
app.get('/api/storage',auth,(req,res)=>{const own=[...db.posts.filter(p=>p.userId===req.user.id&&p.file),...db.stories.filter(x=>x.userId===req.user.id&&x.file),...db.messages.filter(m=>(m.from===req.user.id||m.to===req.user.id)&&m.url),...db.users.filter(u=>u.id===req.user.id&&u.avatar).map(u=>({file:u.avatar,fileName:'Profile photo',mime:'image',size:0,createdAt:u.createdAt}))];const unique=[...new Map(own.map(f=>[f.file||f.url,f])).values()];res.json({files:unique.map(f=>({name:f.fileName||f.url?.split('/').pop()||f.file?.split('/').pop()||'File',url:f.file||f.url,type:f.mime||f.type,size:f.size||0,createdAt:f.createdAt})),used:unique.reduce((n,f)=>n+(f.size||0),0),limit:500*1024*1024});});
app.post('/api/report',auth,(req,res)=>{const reason=clean(req.body.reason).slice(0,300);if(!reason)return res.status(400).json({error:'Reason required'});db.reports.push({id:id(),userId:req.user.id,reason,createdAt:new Date().toISOString()});save();res.json({ok:true});});

io.on('connection',socket=>{
 const uid=socket.handshake.session?.userId; if(!uid)return socket.disconnect(true); socket.join('user:'+uid);
 socket.on('call:offer',data=>{if(data?.to)io.to('user:'+data.to).emit('call:incoming',{from:uid,offer:data.offer,video:!!data.video});});
 socket.on('call:answer',data=>{if(data?.to)io.to('user:'+data.to).emit('call:answer',{from:uid,answer:data.answer});});
 socket.on('call:ice',data=>{if(data?.to)io.to('user:'+data.to).emit('call:ice',{from:uid,candidate:data.candidate});});
 socket.on('call:end',data=>{if(data?.to)io.to('user:'+data.to).emit('call:end',{from:uid});});
});
app.use((err,req,res,next)=>{console.error(err);res.status(400).json({error:err.message||'Request failed'});});
server.listen(PORT,'0.0.0.0',()=>console.log('HYPER running on '+PORT));
