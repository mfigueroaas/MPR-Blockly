// MPR: mide, sin abrir la app, si alguna pose de la mascota Otto 3D se sale de su canvas (150x190 px): proyecta cada
// vértice de cada pose (reposo, cada animación de MPROtto3D.ANIMACIONES y caminar) con la misma cámara de mpr_otto3d.js.
// Uso: node tools/medir_poses.js www      (marca "SE SALE" si una pose queda cortada). Correrlo al cambiar una animación.
const fs = require('fs'), vm = require('vm');
const W = process.argv[2];
const ctx = { window: {}, console, performance: { now: () => 0 }, requestAnimationFrame() {}, document: { addEventListener() {} }, atob: s => Buffer.from(s, 'base64').toString('binary'), Math };
ctx.window = ctx; ctx.self = ctx;
vm.createContext(ctx);
for (const f of ['js/three.min.js', 'media/otto3d_liviano.js', 'js/mpr_otto3d.js']) vm.runInContext(fs.readFileSync(W + '/' + f, 'utf8'), ctx, { filename: f });
const r = vm.runInContext(`(function(){
  var T = THREE, O = MPROtto3D;
  O.escena = new T.Scene();
  O.camara = new T.PerspectiveCamera(28, 150/190, 50, 2000); O.camara.position.set(0, 82, 380); O.camara.lookAt(new T.Vector3(0, 60, 0));
  O.camara.updateMatrixWorld(); O.camara.updateProjectionMatrix();
  O.mat = {}; O.PARTES_COLOR.forEach(function(n){ O.mat[n] = new T.MeshLambertMaterial(); });
  O.matPlata = new T.MeshLambertMaterial(); O.matOscuro = new T.MeshBasicMaterial();
  O.armar();
  var v = new T.Vector3();
  function medir() {
    O.escena.updateMatrixWorld(true);
    var b = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 };
    O.raiz.traverse(function(o) {
      if (!o.geometry) return;
      var p = o.geometry.attributes.position;
      for (var i = 0; i < p.count; i += 3) {
        v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).project(O.camara);
        var x = (v.x + 1) / 2 * 150, y = (1 - v.y) / 2 * 190;
        if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
      }
    });
    return b;
  }
  var res = {};
  function peor(nombre, b) {
    var a = res[nombre] || (res[nombre] = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 });
    a.x0 = Math.min(a.x0, b.x0); a.x1 = Math.max(a.x1, b.x1); a.y0 = Math.min(a.y0, b.y0); a.y1 = Math.max(a.y1, b.y1);
  }
  // reposo (con la mirada a los lados), cada animación y caminar de perfil
  [-1, 0, 1].forEach(function(mx) { O.mirada = { x: mx, y: 0, ax: mx, ay: 0 }; O.tPrev = 0; O.estado = { nombre: 'reposo', inicio: 0 };
    for (var t = 0; t < 6; t += 0.05) { O.pose(t); peor('reposo', medir()); } });
  O.mirada = { x: 1, y: 0, ax: 1, ay: 0 };
  Object.keys(O.ANIMACIONES).forEach(function(n) {
    O.tPrev = 0; O.estado = { nombre: n, inicio: 10 };
    for (var t = 10; t < 10 + O.ANIMACIONES[n]; t += 0.02) { O.pose(t); peor(n, medir()); }
  });
  [-1, 1].forEach(function(d) { O.estado = { nombre: 'reposo', inicio: 0 }; O.rumbo = 0; O.andar = 0; O.caminar(d); O.tPrev = 20;
    for (var t = 20; t < 26; t += 0.02) { O.pose(t); peor('caminar', medir()); } O.pararCaminar(); });
  var out = {}; for (var k in res) { var a = res[k]; out[k] = 'x ' + a.x0.toFixed(1) + '..' + a.x1.toFixed(1) + '  y ' + a.y0.toFixed(1) + '..' + a.y1.toFixed(1) + (a.x0 < 0 || a.y0 < 0 || a.x1 > 150 || a.y1 > 190 ? '   <-- SE SALE' : ''); }
  return out;
})()`, ctx);
for (const k in r) console.log(k.padEnd(9), r[k]);
