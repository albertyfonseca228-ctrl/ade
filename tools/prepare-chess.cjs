const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { scriptClassId } = require('./cocos-class-id.cjs');
const upstream = fs.readFileSync('assets/scripts/vendor/xiangqi.js', 'utf8');
const core = upstream.slice(0, upstream.indexOf('/* export Xiangqi object'));
fs.writeFileSync('assets/scripts/vendor/xiangqi-esm.ts', '// @ts-nocheck\n// Integration change: replace CommonJS/AMD exports with an ES module export.\n' + core + '\nexport { Xiangqi };\n');
const scriptMetaPath = 'assets/scripts/chess/ChessGame.ts.meta';
if (!fs.existsSync(scriptMetaPath)) throw new Error('ChessGame.ts.meta is required; do not replace its UUID.');
const scriptUUID = JSON.parse(fs.readFileSync(scriptMetaPath, 'utf8')).uuid;
function meta(file, importer, ver, uuid = crypto.randomUUID()) {
    if (!fs.existsSync(file + '.meta')) fs.writeFileSync(file + '.meta', JSON.stringify({ver, importer, imported:true, uuid, files:[], subMetas:{}, userData:{}}, null, 2));
}
const sceneUUID = JSON.parse(fs.readFileSync('assets/scenes/ChineseChess.scene.meta', 'utf8')).uuid;
function node(name, parent, children, components, layer = 33554432, pos = [0,0,0]) {
    return {__type__:'cc.Node', _name:name, _objFlags:0, __editorExtras__:{}, _parent:{__id__:parent}, _children:children.map(__id__=>({__id__})), _active:true, _components:components.map(__id__=>({__id__})), _prefab:null, _lpos:{__type__:'cc.Vec3',x:pos[0],y:pos[1],z:pos[2]}, _lrot:{__type__:'cc.Quat',x:0,y:0,z:0,w:1}, _lscale:{__type__:'cc.Vec3',x:1,y:1,z:1}, _layer:layer, _mobility:0, _euler:{__type__:'cc.Vec3',x:0,y:0,z:0}, _id:crypto.randomUUID()};
}
function component(type, id, props = {}) { return {__type__:type, _name:'', _objFlags:0, __editorExtras__:{}, node:{__id__:id}, _enabled:true, __prefab:null, ...props}; }
const scene = [
    {__type__:'cc.SceneAsset',_name:'ChineseChess',_objFlags:0,__editorExtras__:{},_native:'',scene:{__id__:1}},
    {...node('ChineseChess',0,[2],[],1073741824),__type__:'cc.Scene',_parent:null,autoReleaseAssets:false,_id:sceneUUID},
    node('Canvas',1,[3],[5,6,7],33554432,[360,640,0]),
    node('Camera',2,[],[4],1073741824,[0,0,1000]),
    component('cc.Camera',3,{_projection:0,_priority:0,_fov:45,_fovAxis:0,_orthoHeight:640,_near:0,_far:2000,_color:{__type__:'cc.Color',r:249,g:237,b:210,a:255},_depth:1,_stencil:0,_clearFlags:7,_rect:{__type__:'cc.Rect',x:0,y:0,width:1,height:1},_visibility:33554432,_targetTexture:null,_cameraType:-1,_trackingType:0}),
    component('cc.UITransform',2,{_contentSize:{__type__:'cc.Size',width:720,height:1280},_anchorPoint:{__type__:'cc.Vec2',x:0.5,y:0.5}}),
    component('cc.Canvas',2,{_cameraComponent:{__id__:4},_alignCanvasWithScreen:true}),
    component(scriptClassId(scriptUUID),2),
];
const scenePath = 'assets/scenes/ChineseChess.scene';
if (fs.existsSync(scenePath)) {
    // Repair binding without replacing existing node IDs or scene/editor data.
    const existing = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
    const canvas = existing.find(item => item.__type__ === 'cc.Node' && item._name === 'Canvas');
    if (!canvas) throw new Error('Existing scene has no Canvas; refusing to overwrite it.');
    const scripts = canvas._components.map(ref => existing[ref.__id__]).filter(item => !item.__type__.startsWith('cc.'));
    if (scripts.length !== 1) throw new Error('Ambiguous Canvas script bindings; refusing to overwrite scene.');
    scripts[0].__type__ = scriptClassId(scriptUUID);
    fs.writeFileSync(scenePath, JSON.stringify(existing, null, 2));
} else {
    fs.writeFileSync(scenePath, JSON.stringify(scene, null, 2));
}
meta('assets/scenes/ChineseChess.scene','scene','1.1.50',sceneUUID);
function walk(dir) {
    for(const e of fs.readdirSync(dir,{withFileTypes:true})) {
        if(e.name.endsWith('.meta')) continue;
        const p=path.join(dir,e.name);
        if(e.isDirectory()) { meta(p,'directory','1.2.0'); walk(p); }
        else if(p.endsWith('.ts')) meta(p,'typescript','4.0.24',e.name==='ChessGame.ts'?scriptUUID:undefined);
        else if(p.endsWith('.js')) meta(p,'javascript','4.0.24');
        else if(p.endsWith('.txt')) meta(p,'text','1.0.0');
    }
}
walk('assets');
const settingsPath='settings/v2/packages/project.json';
const settings=JSON.parse(fs.readFileSync(settingsPath,'utf8'));
settings.general={...settings.general,designResolution:{width:720,height:1280,fitWidth:true,fitHeight:true}};
fs.writeFileSync(settingsPath,JSON.stringify(settings,null,2));
const rev=JSON.parse(fs.readFileSync('tools/upstream-commit.json','utf8')).sha;
fs.writeFileSync('docs/THIRD_PARTY.md',`# Third-party notices\n\nxiangqi.js: https://github.com/lengyanyu258/xiangqi.js\n\nRevision: ${rev}\n\nLicense: BSD-2-Clause. Full original source and license are preserved in assets/scripts/vendor/xiangqi.js and LICENSE.txt.\n\nxiangqi-esm.ts is generated from that source, replacing only CommonJS/AMD exports with an ES module export and disabling type checking for unmodified upstream JavaScript. No DOM, npm or runtime network dependency.\n\nBinary distributions (including APK) must ship the full LICENSE.txt in accompanying materials. Keep both copyright notices and the disclaimer.\n\nThe inherited draw policy is threefold repetition, 120 non-capture half-moves, or insufficient material. Stalemate is a loss. Tournament long-check/long-chase adjudication is outside this version.\n`);
console.log('Scene, metadata, ES module and attribution prepared; upstream',rev);
