// Vendored: the piper_phonemize emscripten module factory, extracted from
// the published piper-tts-web@1.1.2 bundle (MIT — see LICENSE and README.md
// for provenance and extraction details).
//
// Two deliberate edits were made to the extracted factory, and nothing else:
// 1. A facade object (declared below) replaces the two module-namespace
//    stubs (`__viteBrowserExternal`, `__CJS__import__3__`) that the bundle's
//    vite build substituted for `fs`/`path` in the emscripten glue's Node
//    branch — the glue was compiled with Node support, the bundler just
//    severed it. The facade forwards readFile/join/dirname to the real
//    modules so the Node branch reads piper_phonemize.wasm/.data from disk.
// 2. UMD-style module.exports wiring (standard MODULARIZE shape).
//
// The binary companions (piper_phonemize.wasm, piper_phonemize.data) are
// NOT in this repository: the engine downloads them at first use, pinned to
// a version and sha256 recorded in server/tts/model-manager.ts.
var __viteBrowserExternal = {
  readFile: function () { return require("fs").readFile.apply(require("fs"), arguments); },
  readFileSync: function () { return require("fs").readFileSync.apply(require("fs"), arguments); },
  existsSync: function (p) { return require("fs").existsSync(p); },
  join: function () { return require("path").join.apply(require("path"), arguments); },
  dirname: function (p) { return require("path").dirname(p); },
  resolve: function () { return require("path").resolve.apply(require("path"), arguments); },
};
var __CJS__import__3__ = __viteBrowserExternal;
var createPiperPhonemize = (() => {
  var A = typeof document < "u" ? document.currentScript?.src : void 0;
  return typeof __filename < "u" && (A = A || __filename), function(I = {}) {
    var C, g = I, N, i, o = new Promise((P, gA) => {
      N = P, i = gA;
    }), L = typeof window == "object", S = typeof WorkerGlobalScope < "u", U = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string" && process.type != "renderer";
    g.expectedDataFileDownloads ??= 0, g.expectedDataFileDownloads++, (() => {
      var P = typeof ENVIRONMENT_IS_PTHREAD < "u" && ENVIRONMENT_IS_PTHREAD, gA = typeof ENVIRONMENT_IS_WASM_WORKER < "u" && ENVIRONMENT_IS_WASM_WORKER;
      if (P || gA) return;
      var wA = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string";
      function hA(pA) {
        typeof window == "object" ? window.encodeURIComponent(window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/")) + "/") : typeof process > "u" && typeof location < "u" && encodeURIComponent(location.pathname.substring(0, location.pathname.lastIndexOf("/")) + "/");
        var CI = "piper_phonemize.data", fA = "piper_phonemize.data", NI = g.locateFile ? g.locateFile(fA, "") : fA, tI = pA.remote_package_size;
        function MC(dI, eC, vI, sC) {
          if (wA) {
            (__viteBrowserExternal || __CJS__import__3__).readFile(dI, (nC, OC) => {
              nC ? sC(nC) : vI(OC.buffer);
            });
            return;
          }
          g.dataFileDownloads ??= {}, fetch(dI).catch((nC) => Promise.reject(new Error(`Network Error: ${dI}`, { cause: nC }))).then((nC) => {
            if (!nC.ok)
              return Promise.reject(new Error(`${nC.status}: ${nC.url}`));
            if (!nC.body && nC.arrayBuffer)
              return nC.arrayBuffer().then(vI);
            const OC = nC.body.getReader(), zC = () => OC.read().then(yI).catch((hI) => Promise.reject(new Error(`Unexpected error while handling : ${nC.url} ${hI}`, { cause: hI }))), CC = [], GA = nC.headers, JA = Number(GA.get("Content-Length") ?? eC);
            let WA = 0;
            const yI = ({ done: hI, value: _I }) => {
              if (hI) {
                const lC = new Uint8Array(CC.map((BQ) => BQ.length).reduce((BQ, SQ) => BQ + SQ, 0));
                let oC = 0;
                for (const BQ of CC)
                  lC.set(BQ, oC), oC += BQ.length;
                vI(lC.buffer);
              } else {
                CC.push(_I), WA += _I.length, g.dataFileDownloads[dI] = { loaded: WA, total: JA };
                let lC = 0, oC = 0;
                for (const BQ of Object.values(g.dataFileDownloads))
                  lC += BQ.loaded, oC += BQ.total;
                return g.setStatus?.(`Downloading data... (${lC}/${oC})`), zC();
              }
            };
            return g.setStatus?.("Downloading data..."), zC();
          });
        }
        function aC(dI) {
          console.error("package error:", dI);
        }
        var OI = null, NC = g.getPreloadedPackage ? g.getPreloadedPackage(NI, tI) : null;
        NC || MC(NI, tI, (dI) => {
          OI ? (OI(dI), OI = null) : NC = dI;
        }, aC);
        function hC(dI) {
          function eC(zC, CC) {
            if (!zC) throw CC + new Error().stack;
          }
          dI.FS_createPath("/", "espeak-ng-data", !0, !0), dI.FS_createPath("/espeak-ng-data", "lang", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "aav", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "art", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "azc", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "bat", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "bnt", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "ccs", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "cel", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "cus", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "dra", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "esx", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "gmq", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "gmw", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "grk", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "inc", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "ine", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "ira", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "iro", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "itc", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "jpx", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "map", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "miz", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "myn", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "poz", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "roa", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "sai", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "sem", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "sit", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "tai", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "trk", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "urj", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "zle", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "zls", !0, !0), dI.FS_createPath("/espeak-ng-data/lang", "zlw", !0, !0), dI.FS_createPath("/espeak-ng-data", "mbrola_ph", !0, !0), dI.FS_createPath("/espeak-ng-data", "voices", !0, !0), dI.FS_createPath("/espeak-ng-data/voices", "!v", !0, !0), dI.FS_createPath("/espeak-ng-data/voices", "mb", !0, !0);
          function vI(zC, CC, GA) {
            this.start = zC, this.end = CC, this.audio = GA;
          }
          vI.prototype = { requests: {}, open: function(zC, CC) {
            this.name = CC, this.requests[CC] = this, dI.addRunDependency(`fp ${this.name}`);
          }, send: function() {
          }, onload: function() {
            var zC = this.byteArray.subarray(this.start, this.end);
            this.finish(zC);
          }, finish: function(zC) {
            var CC = this;
            dI.FS_createDataFile(this.name, null, zC, !0, !0, !0), dI.removeRunDependency(`fp ${CC.name}`), this.requests[this.name] = null;
          } };
          for (var sC = pA.files, nC = 0; nC < sC.length; ++nC)
            new vI(sC[nC].start, sC[nC].end, sC[nC].audio || 0).open("GET", sC[nC].filename);
          function OC(zC) {
            eC(zC, "Loading data file failed."), eC(zC.constructor.name === ArrayBuffer.name, "bad input to processPackageData");
            var CC = new Uint8Array(zC);
            vI.prototype.byteArray = CC;
            for (var GA = pA.files, JA = 0; JA < GA.length; ++JA)
              vI.prototype.requests[GA[JA].filename].onload();
            dI.removeRunDependency("datafile_piper_phonemize.data");
          }
          dI.addRunDependency("datafile_piper_phonemize.data"), dI.preloadResults ??= {}, dI.preloadResults[CI] = { fromCache: !1 }, NC ? (OC(NC), NC = null) : OI = OC;
        }
        g.calledRun ? hC(g) : (g.preRun ??= []).push(hC);
      }
      hA({ files: [{ filename: "/espeak-ng-data/af_dict", start: 0, end: 121473 }, { filename: "/espeak-ng-data/am_dict", start: 121473, end: 185351 }, { filename: "/espeak-ng-data/an_dict", start: 185351, end: 192042 }, { filename: "/espeak-ng-data/ar_dict", start: 192042, end: 670207 }, { filename: "/espeak-ng-data/as_dict", start: 670207, end: 675212 }, { filename: "/espeak-ng-data/az_dict", start: 675212, end: 718985 }, { filename: "/espeak-ng-data/ba_dict", start: 718985, end: 721083 }, { filename: "/espeak-ng-data/be_dict", start: 721083, end: 723735 }, { filename: "/espeak-ng-data/bg_dict", start: 723735, end: 810786 }, { filename: "/espeak-ng-data/bn_dict", start: 810786, end: 900765 }, { filename: "/espeak-ng-data/bpy_dict", start: 900765, end: 905991 }, { filename: "/espeak-ng-data/bs_dict", start: 905991, end: 953059 }, { filename: "/espeak-ng-data/ca_dict", start: 953059, end: 998625 }, { filename: "/espeak-ng-data/chr_dict", start: 998625, end: 1001484 }, { filename: "/espeak-ng-data/cmn_dict", start: 1001484, end: 2567819 }, { filename: "/espeak-ng-data/cs_dict", start: 2567819, end: 2617464 }, { filename: "/espeak-ng-data/cv_dict", start: 2617464, end: 2618808 }, { filename: "/espeak-ng-data/cy_dict", start: 2618808, end: 2661938 }, { filename: "/espeak-ng-data/da_dict", start: 2661938, end: 2907225 }, { filename: "/espeak-ng-data/de_dict", start: 2907225, end: 2975501 }, { filename: "/espeak-ng-data/el_dict", start: 2975501, end: 3048342 }, { filename: "/espeak-ng-data/en_dict", start: 3048342, end: 3215286 }, { filename: "/espeak-ng-data/eo_dict", start: 3215286, end: 3219952 }, { filename: "/espeak-ng-data/es_dict", start: 3219952, end: 3269204 }, { filename: "/espeak-ng-data/et_dict", start: 3269204, end: 3313467 }, { filename: "/espeak-ng-data/eu_dict", start: 3313467, end: 3362308 }, { filename: "/espeak-ng-data/fa_dict", start: 3362308, end: 3655543 }, { filename: "/espeak-ng-data/fi_dict", start: 3655543, end: 3699471 }, { filename: "/espeak-ng-data/fr_dict", start: 3699471, end: 3763198 }, { filename: "/espeak-ng-data/ga_dict", start: 3763198, end: 3815871 }, { filename: "/espeak-ng-data/gd_dict", start: 3815871, end: 3864992 }, { filename: "/espeak-ng-data/gn_dict", start: 3864992, end: 3868240 }, { filename: "/espeak-ng-data/grc_dict", start: 3868240, end: 3871673 }, { filename: "/espeak-ng-data/gu_dict", start: 3871673, end: 3954153 }, { filename: "/espeak-ng-data/hak_dict", start: 3954153, end: 3957488 }, { filename: "/espeak-ng-data/haw_dict", start: 3957488, end: 3959931 }, { filename: "/espeak-ng-data/he_dict", start: 3959931, end: 3966894 }, { filename: "/espeak-ng-data/hi_dict", start: 3966894, end: 4059037 }, { filename: "/espeak-ng-data/hr_dict", start: 4059037, end: 4108425 }, { filename: "/espeak-ng-data/ht_dict", start: 4108425, end: 4110228 }, { filename: "/espeak-ng-data/hu_dict", start: 4110228, end: 4264013 }, { filename: "/espeak-ng-data/hy_dict", start: 4264013, end: 4326276 }, { filename: "/espeak-ng-data/ia_dict", start: 4326276, end: 4657551 }, { filename: "/espeak-ng-data/id_dict", start: 4657551, end: 4701009 }, { filename: "/espeak-ng-data/intonations", start: 4701009, end: 4703049 }, { filename: "/espeak-ng-data/io_dict", start: 4703049, end: 4705214 }, { filename: "/espeak-ng-data/is_dict", start: 4705214, end: 4749568 }, { filename: "/espeak-ng-data/it_dict", start: 4749568, end: 4902457 }, { filename: "/espeak-ng-data/ja_dict", start: 4902457, end: 4950109 }, { filename: "/espeak-ng-data/jbo_dict", start: 4950109, end: 4952352 }, { filename: "/espeak-ng-data/ka_dict", start: 4952352, end: 5040127 }, { filename: "/espeak-ng-data/kk_dict", start: 5040127, end: 5041986 }, { filename: "/espeak-ng-data/kl_dict", start: 5041986, end: 5044824 }, { filename: "/espeak-ng-data/kn_dict", start: 5044824, end: 5132652 }, { filename: "/espeak-ng-data/ko_dict", start: 5132652, end: 5180175 }, { filename: "/espeak-ng-data/kok_dict", start: 5180175, end: 5186569 }, { filename: "/espeak-ng-data/ku_dict", start: 5186569, end: 5188834 }, { filename: "/espeak-ng-data/ky_dict", start: 5188834, end: 5253811 }, { filename: "/espeak-ng-data/la_dict", start: 5253811, end: 5257617 }, { filename: "/espeak-ng-data/lang/aav/vi", start: 5257617, end: 5257728 }, { filename: "/espeak-ng-data/lang/aav/vi-VN-x-central", start: 5257728, end: 5257871 }, { filename: "/espeak-ng-data/lang/aav/vi-VN-x-south", start: 5257871, end: 5258013 }, { filename: "/espeak-ng-data/lang/art/eo", start: 5258013, end: 5258054 }, { filename: "/espeak-ng-data/lang/art/ia", start: 5258054, end: 5258083 }, { filename: "/espeak-ng-data/lang/art/io", start: 5258083, end: 5258133 }, { filename: "/espeak-ng-data/lang/art/jbo", start: 5258133, end: 5258202 }, { filename: "/espeak-ng-data/lang/art/lfn", start: 5258202, end: 5258337 }, { filename: "/espeak-ng-data/lang/art/piqd", start: 5258337, end: 5258393 }, { filename: "/espeak-ng-data/lang/art/py", start: 5258393, end: 5258533 }, { filename: "/espeak-ng-data/lang/art/qdb", start: 5258533, end: 5258590 }, { filename: "/espeak-ng-data/lang/art/qya", start: 5258590, end: 5258763 }, { filename: "/espeak-ng-data/lang/art/sjn", start: 5258763, end: 5258938 }, { filename: "/espeak-ng-data/lang/azc/nci", start: 5258938, end: 5259052 }, { filename: "/espeak-ng-data/lang/bat/lt", start: 5259052, end: 5259080 }, { filename: "/espeak-ng-data/lang/bat/ltg", start: 5259080, end: 5259392 }, { filename: "/espeak-ng-data/lang/bat/lv", start: 5259392, end: 5259621 }, { filename: "/espeak-ng-data/lang/bnt/sw", start: 5259621, end: 5259662 }, { filename: "/espeak-ng-data/lang/bnt/tn", start: 5259662, end: 5259704 }, { filename: "/espeak-ng-data/lang/ccs/ka", start: 5259704, end: 5259828 }, { filename: "/espeak-ng-data/lang/cel/cy", start: 5259828, end: 5259865 }, { filename: "/espeak-ng-data/lang/cel/ga", start: 5259865, end: 5259931 }, { filename: "/espeak-ng-data/lang/cel/gd", start: 5259931, end: 5259982 }, { filename: "/espeak-ng-data/lang/cus/om", start: 5259982, end: 5260021 }, { filename: "/espeak-ng-data/lang/dra/kn", start: 5260021, end: 5260076 }, { filename: "/espeak-ng-data/lang/dra/ml", start: 5260076, end: 5260133 }, { filename: "/espeak-ng-data/lang/dra/ta", start: 5260133, end: 5260184 }, { filename: "/espeak-ng-data/lang/dra/te", start: 5260184, end: 5260254 }, { filename: "/espeak-ng-data/lang/esx/kl", start: 5260254, end: 5260284 }, { filename: "/espeak-ng-data/lang/eu", start: 5260284, end: 5260338 }, { filename: "/espeak-ng-data/lang/gmq/da", start: 5260338, end: 5260381 }, { filename: "/espeak-ng-data/lang/gmq/is", start: 5260381, end: 5260408 }, { filename: "/espeak-ng-data/lang/gmq/nb", start: 5260408, end: 5260495 }, { filename: "/espeak-ng-data/lang/gmq/sv", start: 5260495, end: 5260520 }, { filename: "/espeak-ng-data/lang/gmw/af", start: 5260520, end: 5260643 }, { filename: "/espeak-ng-data/lang/gmw/de", start: 5260643, end: 5260685 }, { filename: "/espeak-ng-data/lang/gmw/en", start: 5260685, end: 5260825 }, { filename: "/espeak-ng-data/lang/gmw/en-029", start: 5260825, end: 5261160 }, { filename: "/espeak-ng-data/lang/gmw/en-GB-scotland", start: 5261160, end: 5261455 }, { filename: "/espeak-ng-data/lang/gmw/en-GB-x-gbclan", start: 5261455, end: 5261693 }, { filename: "/espeak-ng-data/lang/gmw/en-GB-x-gbcwmd", start: 5261693, end: 5261881 }, { filename: "/espeak-ng-data/lang/gmw/en-GB-x-rp", start: 5261881, end: 5262130 }, { filename: "/espeak-ng-data/lang/gmw/en-US", start: 5262130, end: 5262387 }, { filename: "/espeak-ng-data/lang/gmw/en-US-nyc", start: 5262387, end: 5262658 }, { filename: "/espeak-ng-data/lang/gmw/lb", start: 5262658, end: 5262689 }, { filename: "/espeak-ng-data/lang/gmw/nl", start: 5262689, end: 5262712 }, { filename: "/espeak-ng-data/lang/grk/el", start: 5262712, end: 5262735 }, { filename: "/espeak-ng-data/lang/grk/grc", start: 5262735, end: 5262834 }, { filename: "/espeak-ng-data/lang/inc/as", start: 5262834, end: 5262876 }, { filename: "/espeak-ng-data/lang/inc/bn", start: 5262876, end: 5262901 }, { filename: "/espeak-ng-data/lang/inc/bpy", start: 5262901, end: 5262940 }, { filename: "/espeak-ng-data/lang/inc/gu", start: 5262940, end: 5262982 }, { filename: "/espeak-ng-data/lang/inc/hi", start: 5262982, end: 5263005 }, { filename: "/espeak-ng-data/lang/inc/kok", start: 5263005, end: 5263031 }, { filename: "/espeak-ng-data/lang/inc/mr", start: 5263031, end: 5263072 }, { filename: "/espeak-ng-data/lang/inc/ne", start: 5263072, end: 5263109 }, { filename: "/espeak-ng-data/lang/inc/or", start: 5263109, end: 5263148 }, { filename: "/espeak-ng-data/lang/inc/pa", start: 5263148, end: 5263173 }, { filename: "/espeak-ng-data/lang/inc/sd", start: 5263173, end: 5263239 }, { filename: "/espeak-ng-data/lang/inc/si", start: 5263239, end: 5263294 }, { filename: "/espeak-ng-data/lang/inc/ur", start: 5263294, end: 5263388 }, { filename: "/espeak-ng-data/lang/ine/hy", start: 5263388, end: 5263449 }, { filename: "/espeak-ng-data/lang/ine/hyw", start: 5263449, end: 5263814 }, { filename: "/espeak-ng-data/lang/ine/sq", start: 5263814, end: 5263917 }, { filename: "/espeak-ng-data/lang/ira/fa", start: 5263917, end: 5264007 }, { filename: "/espeak-ng-data/lang/ira/fa-Latn", start: 5264007, end: 5264276 }, { filename: "/espeak-ng-data/lang/ira/ku", start: 5264276, end: 5264316 }, { filename: "/espeak-ng-data/lang/iro/chr", start: 5264316, end: 5264885 }, { filename: "/espeak-ng-data/lang/itc/la", start: 5264885, end: 5265182 }, { filename: "/espeak-ng-data/lang/jpx/ja", start: 5265182, end: 5265234 }, { filename: "/espeak-ng-data/lang/ko", start: 5265234, end: 5265285 }, { filename: "/espeak-ng-data/lang/map/haw", start: 5265285, end: 5265327 }, { filename: "/espeak-ng-data/lang/miz/mto", start: 5265327, end: 5265510 }, { filename: "/espeak-ng-data/lang/myn/quc", start: 5265510, end: 5265720 }, { filename: "/espeak-ng-data/lang/poz/id", start: 5265720, end: 5265854 }, { filename: "/espeak-ng-data/lang/poz/mi", start: 5265854, end: 5266221 }, { filename: "/espeak-ng-data/lang/poz/ms", start: 5266221, end: 5266651 }, { filename: "/espeak-ng-data/lang/qu", start: 5266651, end: 5266739 }, { filename: "/espeak-ng-data/lang/roa/an", start: 5266739, end: 5266766 }, { filename: "/espeak-ng-data/lang/roa/ca", start: 5266766, end: 5266791 }, { filename: "/espeak-ng-data/lang/roa/es", start: 5266791, end: 5266854 }, { filename: "/espeak-ng-data/lang/roa/es-419", start: 5266854, end: 5267021 }, { filename: "/espeak-ng-data/lang/roa/fr", start: 5267021, end: 5267100 }, { filename: "/espeak-ng-data/lang/roa/fr-BE", start: 5267100, end: 5267184 }, { filename: "/espeak-ng-data/lang/roa/fr-CH", start: 5267184, end: 5267270 }, { filename: "/espeak-ng-data/lang/roa/ht", start: 5267270, end: 5267410 }, { filename: "/espeak-ng-data/lang/roa/it", start: 5267410, end: 5267519 }, { filename: "/espeak-ng-data/lang/roa/pap", start: 5267519, end: 5267581 }, { filename: "/espeak-ng-data/lang/roa/pt", start: 5267581, end: 5267676 }, { filename: "/espeak-ng-data/lang/roa/pt-BR", start: 5267676, end: 5267785 }, { filename: "/espeak-ng-data/lang/roa/ro", start: 5267785, end: 5267811 }, { filename: "/espeak-ng-data/lang/sai/gn", start: 5267811, end: 5267858 }, { filename: "/espeak-ng-data/lang/sem/am", start: 5267858, end: 5267899 }, { filename: "/espeak-ng-data/lang/sem/ar", start: 5267899, end: 5267949 }, { filename: "/espeak-ng-data/lang/sem/he", start: 5267949, end: 5267989 }, { filename: "/espeak-ng-data/lang/sem/mt", start: 5267989, end: 5268030 }, { filename: "/espeak-ng-data/lang/sit/cmn", start: 5268030, end: 5268716 }, { filename: "/espeak-ng-data/lang/sit/cmn-Latn-pinyin", start: 5268716, end: 5268877 }, { filename: "/espeak-ng-data/lang/sit/hak", start: 5268877, end: 5269005 }, { filename: "/espeak-ng-data/lang/sit/my", start: 5269005, end: 5269061 }, { filename: "/espeak-ng-data/lang/sit/yue", start: 5269061, end: 5269255 }, { filename: "/espeak-ng-data/lang/sit/yue-Latn-jyutping", start: 5269255, end: 5269468 }, { filename: "/espeak-ng-data/lang/tai/shn", start: 5269468, end: 5269560 }, { filename: "/espeak-ng-data/lang/tai/th", start: 5269560, end: 5269597 }, { filename: "/espeak-ng-data/lang/trk/az", start: 5269597, end: 5269642 }, { filename: "/espeak-ng-data/lang/trk/ba", start: 5269642, end: 5269667 }, { filename: "/espeak-ng-data/lang/trk/cv", start: 5269667, end: 5269707 }, { filename: "/espeak-ng-data/lang/trk/kk", start: 5269707, end: 5269747 }, { filename: "/espeak-ng-data/lang/trk/ky", start: 5269747, end: 5269790 }, { filename: "/espeak-ng-data/lang/trk/nog", start: 5269790, end: 5269829 }, { filename: "/espeak-ng-data/lang/trk/tk", start: 5269829, end: 5269854 }, { filename: "/espeak-ng-data/lang/trk/tr", start: 5269854, end: 5269879 }, { filename: "/espeak-ng-data/lang/trk/tt", start: 5269879, end: 5269902 }, { filename: "/espeak-ng-data/lang/trk/ug", start: 5269902, end: 5269926 }, { filename: "/espeak-ng-data/lang/trk/uz", start: 5269926, end: 5269965 }, { filename: "/espeak-ng-data/lang/urj/et", start: 5269965, end: 5270202 }, { filename: "/espeak-ng-data/lang/urj/fi", start: 5270202, end: 5270439 }, { filename: "/espeak-ng-data/lang/urj/hu", start: 5270439, end: 5270512 }, { filename: "/espeak-ng-data/lang/urj/smj", start: 5270512, end: 5270557 }, { filename: "/espeak-ng-data/lang/zle/be", start: 5270557, end: 5270609 }, { filename: "/espeak-ng-data/lang/zle/ru", start: 5270609, end: 5270666 }, { filename: "/espeak-ng-data/lang/zle/ru-LV", start: 5270666, end: 5270946 }, { filename: "/espeak-ng-data/lang/zle/ru-cl", start: 5270946, end: 5271037 }, { filename: "/espeak-ng-data/lang/zle/uk", start: 5271037, end: 5271134 }, { filename: "/espeak-ng-data/lang/zls/bg", start: 5271134, end: 5271245 }, { filename: "/espeak-ng-data/lang/zls/bs", start: 5271245, end: 5271475 }, { filename: "/espeak-ng-data/lang/zls/hr", start: 5271475, end: 5271737 }, { filename: "/espeak-ng-data/lang/zls/mk", start: 5271737, end: 5271765 }, { filename: "/espeak-ng-data/lang/zls/sl", start: 5271765, end: 5271808 }, { filename: "/espeak-ng-data/lang/zls/sr", start: 5271808, end: 5272058 }, { filename: "/espeak-ng-data/lang/zlw/cs", start: 5272058, end: 5272081 }, { filename: "/espeak-ng-data/lang/zlw/pl", start: 5272081, end: 5272119 }, { filename: "/espeak-ng-data/lang/zlw/sk", start: 5272119, end: 5272143 }, { filename: "/espeak-ng-data/lb_dict", start: 5272143, end: 5960074 }, { filename: "/espeak-ng-data/lfn_dict", start: 5960074, end: 5962867 }, { filename: "/espeak-ng-data/lt_dict", start: 5962867, end: 6012757 }, { filename: "/espeak-ng-data/lv_dict", start: 6012757, end: 6079094 }, { filename: "/espeak-ng-data/mbrola_ph/af1_phtrans", start: 6079094, end: 6080730 }, { filename: "/espeak-ng-data/mbrola_ph/ar1_phtrans", start: 6080730, end: 6082342 }, { filename: "/espeak-ng-data/mbrola_ph/ar2_phtrans", start: 6082342, end: 6083954 }, { filename: "/espeak-ng-data/mbrola_ph/ca_phtrans", start: 6083954, end: 6085950 }, { filename: "/espeak-ng-data/mbrola_ph/cmn_phtrans", start: 6085950, end: 6087442 }, { filename: "/espeak-ng-data/mbrola_ph/cr1_phtrans", start: 6087442, end: 6089606 }, { filename: "/espeak-ng-data/mbrola_ph/cs_phtrans", start: 6089606, end: 6090186 }, { filename: "/espeak-ng-data/mbrola_ph/de2_phtrans", start: 6090186, end: 6091918 }, { filename: "/espeak-ng-data/mbrola_ph/de4_phtrans", start: 6091918, end: 6093722 }, { filename: "/espeak-ng-data/mbrola_ph/de6_phtrans", start: 6093722, end: 6095118 }, { filename: "/espeak-ng-data/mbrola_ph/de8_phtrans", start: 6095118, end: 6096274 }, { filename: "/espeak-ng-data/mbrola_ph/ee1_phtrans", start: 6096274, end: 6097718 }, { filename: "/espeak-ng-data/mbrola_ph/en1_phtrans", start: 6097718, end: 6098514 }, { filename: "/espeak-ng-data/mbrola_ph/es3_phtrans", start: 6098514, end: 6099574 }, { filename: "/espeak-ng-data/mbrola_ph/es4_phtrans", start: 6099574, end: 6100682 }, { filename: "/espeak-ng-data/mbrola_ph/es_phtrans", start: 6100682, end: 6102414 }, { filename: "/espeak-ng-data/mbrola_ph/fr_phtrans", start: 6102414, end: 6104386 }, { filename: "/espeak-ng-data/mbrola_ph/gr1_phtrans", start: 6104386, end: 6106598 }, { filename: "/espeak-ng-data/mbrola_ph/gr2_phtrans", start: 6106598, end: 6108810 }, { filename: "/espeak-ng-data/mbrola_ph/grc-de6_phtrans", start: 6108810, end: 6109294 }, { filename: "/espeak-ng-data/mbrola_ph/he_phtrans", start: 6109294, end: 6110042 }, { filename: "/espeak-ng-data/mbrola_ph/hn1_phtrans", start: 6110042, end: 6110574 }, { filename: "/espeak-ng-data/mbrola_ph/hu1_phtrans", start: 6110574, end: 6112018 }, { filename: "/espeak-ng-data/mbrola_ph/ic1_phtrans", start: 6112018, end: 6113150 }, { filename: "/espeak-ng-data/mbrola_ph/id1_phtrans", start: 6113150, end: 6114858 }, { filename: "/espeak-ng-data/mbrola_ph/in_phtrans", start: 6114858, end: 6116302 }, { filename: "/espeak-ng-data/mbrola_ph/ir1_phtrans", start: 6116302, end: 6122114 }, { filename: "/espeak-ng-data/mbrola_ph/it1_phtrans", start: 6122114, end: 6123438 }, { filename: "/espeak-ng-data/mbrola_ph/it3_phtrans", start: 6123438, end: 6124330 }, { filename: "/espeak-ng-data/mbrola_ph/jp_phtrans", start: 6124330, end: 6125366 }, { filename: "/espeak-ng-data/mbrola_ph/la1_phtrans", start: 6125366, end: 6126114 }, { filename: "/espeak-ng-data/mbrola_ph/lt_phtrans", start: 6126114, end: 6127174 }, { filename: "/espeak-ng-data/mbrola_ph/ma1_phtrans", start: 6127174, end: 6128114 }, { filename: "/espeak-ng-data/mbrola_ph/mx1_phtrans", start: 6128114, end: 6129918 }, { filename: "/espeak-ng-data/mbrola_ph/mx2_phtrans", start: 6129918, end: 6131746 }, { filename: "/espeak-ng-data/mbrola_ph/nl_phtrans", start: 6131746, end: 6133430 }, { filename: "/espeak-ng-data/mbrola_ph/nz1_phtrans", start: 6133430, end: 6134154 }, { filename: "/espeak-ng-data/mbrola_ph/pl1_phtrans", start: 6134154, end: 6135742 }, { filename: "/espeak-ng-data/mbrola_ph/pt1_phtrans", start: 6135742, end: 6137834 }, { filename: "/espeak-ng-data/mbrola_ph/ptbr4_phtrans", start: 6137834, end: 6140190 }, { filename: "/espeak-ng-data/mbrola_ph/ptbr_phtrans", start: 6140190, end: 6142714 }, { filename: "/espeak-ng-data/mbrola_ph/ro1_phtrans", start: 6142714, end: 6144878 }, { filename: "/espeak-ng-data/mbrola_ph/sv2_phtrans", start: 6144878, end: 6146466 }, { filename: "/espeak-ng-data/mbrola_ph/sv_phtrans", start: 6146466, end: 6148054 }, { filename: "/espeak-ng-data/mbrola_ph/tl1_phtrans", start: 6148054, end: 6148826 }, { filename: "/espeak-ng-data/mbrola_ph/tr1_phtrans", start: 6148826, end: 6149190 }, { filename: "/espeak-ng-data/mbrola_ph/us3_phtrans", start: 6149190, end: 6150346 }, { filename: "/espeak-ng-data/mbrola_ph/us_phtrans", start: 6150346, end: 6151574 }, { filename: "/espeak-ng-data/mbrola_ph/vz_phtrans", start: 6151574, end: 6153858 }, { filename: "/espeak-ng-data/mi_dict", start: 6153858, end: 6155204 }, { filename: "/espeak-ng-data/mk_dict", start: 6155204, end: 6219063 }, { filename: "/espeak-ng-data/ml_dict", start: 6219063, end: 6311408 }, { filename: "/espeak-ng-data/mr_dict", start: 6311408, end: 6398799 }, { filename: "/espeak-ng-data/ms_dict", start: 6398799, end: 6452340 }, { filename: "/espeak-ng-data/mt_dict", start: 6452340, end: 6456724 }, { filename: "/espeak-ng-data/mto_dict", start: 6456724, end: 6460684 }, { filename: "/espeak-ng-data/my_dict", start: 6460684, end: 6556632 }, { filename: "/espeak-ng-data/nci_dict", start: 6556632, end: 6558166 }, { filename: "/espeak-ng-data/ne_dict", start: 6558166, end: 6653543 }, { filename: "/espeak-ng-data/nl_dict", start: 6653543, end: 6719522 }, { filename: "/espeak-ng-data/no_dict", start: 6719522, end: 6723700 }, { filename: "/espeak-ng-data/nog_dict", start: 6723700, end: 6726994 }, { filename: "/espeak-ng-data/om_dict", start: 6726994, end: 6729296 }, { filename: "/espeak-ng-data/or_dict", start: 6729296, end: 6818542 }, { filename: "/espeak-ng-data/pa_dict", start: 6818542, end: 6898495 }, { filename: "/espeak-ng-data/pap_dict", start: 6898495, end: 6900623 }, { filename: "/espeak-ng-data/phondata", start: 6900623, end: 7451047 }, { filename: "/espeak-ng-data/phondata-manifest", start: 7451047, end: 7472868 }, { filename: "/espeak-ng-data/phonindex", start: 7472868, end: 7511942 }, { filename: "/espeak-ng-data/phontab", start: 7511942, end: 7567738 }, { filename: "/espeak-ng-data/piqd_dict", start: 7567738, end: 7569448 }, { filename: "/espeak-ng-data/pl_dict", start: 7569448, end: 7646178 }, { filename: "/espeak-ng-data/pt_dict", start: 7646178, end: 7713995 }, { filename: "/espeak-ng-data/py_dict", start: 7713995, end: 7716404 }, { filename: "/espeak-ng-data/qdb_dict", start: 7716404, end: 7719432 }, { filename: "/espeak-ng-data/qu_dict", start: 7719432, end: 7721351 }, { filename: "/espeak-ng-data/quc_dict", start: 7721351, end: 7722801 }, { filename: "/espeak-ng-data/qya_dict", start: 7722801, end: 7724740 }, { filename: "/espeak-ng-data/ro_dict", start: 7724740, end: 7793278 }, { filename: "/espeak-ng-data/ru_dict", start: 7793278, end: 16325670 }, { filename: "/espeak-ng-data/sd_dict", start: 16325670, end: 16385598 }, { filename: "/espeak-ng-data/shn_dict", start: 16385598, end: 16473770 }, { filename: "/espeak-ng-data/si_dict", start: 16473770, end: 16559154 }, { filename: "/espeak-ng-data/sjn_dict", start: 16559154, end: 16560937 }, { filename: "/espeak-ng-data/sk_dict", start: 16560937, end: 16610939 }, { filename: "/espeak-ng-data/sl_dict", start: 16610939, end: 16655986 }, { filename: "/espeak-ng-data/smj_dict", start: 16655986, end: 16691081 }, { filename: "/espeak-ng-data/sq_dict", start: 16691081, end: 16736084 }, { filename: "/espeak-ng-data/sr_dict", start: 16736084, end: 16782916 }, { filename: "/espeak-ng-data/sv_dict", start: 16782916, end: 16830752 }, { filename: "/espeak-ng-data/sw_dict", start: 16830752, end: 16878556 }, { filename: "/espeak-ng-data/ta_dict", start: 16878556, end: 17088109 }, { filename: "/espeak-ng-data/te_dict", start: 17088109, end: 17182946 }, { filename: "/espeak-ng-data/th_dict", start: 17182946, end: 17185247 }, { filename: "/espeak-ng-data/tk_dict", start: 17185247, end: 17206115 }, { filename: "/espeak-ng-data/tn_dict", start: 17206115, end: 17209187 }, { filename: "/espeak-ng-data/tr_dict", start: 17209187, end: 17255980 }, { filename: "/espeak-ng-data/tt_dict", start: 17255980, end: 17258101 }, { filename: "/espeak-ng-data/ug_dict", start: 17258101, end: 17260171 }, { filename: "/espeak-ng-data/uk_dict", start: 17260171, end: 17263663 }, { filename: "/espeak-ng-data/ur_dict", start: 17263663, end: 17397219 }, { filename: "/espeak-ng-data/uz_dict", start: 17397219, end: 17399759 }, { filename: "/espeak-ng-data/vi_dict", start: 17399759, end: 17452367 }, { filename: "/espeak-ng-data/voices/!v/Alex", start: 17452367, end: 17452495 }, { filename: "/espeak-ng-data/voices/!v/Alicia", start: 17452495, end: 17452969 }, { filename: "/espeak-ng-data/voices/!v/Andrea", start: 17452969, end: 17453326 }, { filename: "/espeak-ng-data/voices/!v/Andy", start: 17453326, end: 17453646 }, { filename: "/espeak-ng-data/voices/!v/Annie", start: 17453646, end: 17453961 }, { filename: "/espeak-ng-data/voices/!v/AnxiousAndy", start: 17453961, end: 17454322 }, { filename: "/espeak-ng-data/voices/!v/Demonic", start: 17454322, end: 17458180 }, { filename: "/espeak-ng-data/voices/!v/Denis", start: 17458180, end: 17458485 }, { filename: "/espeak-ng-data/voices/!v/Diogo", start: 17458485, end: 17458864 }, { filename: "/espeak-ng-data/voices/!v/Gene", start: 17458864, end: 17459145 }, { filename: "/espeak-ng-data/voices/!v/Gene2", start: 17459145, end: 17459428 }, { filename: "/espeak-ng-data/voices/!v/Henrique", start: 17459428, end: 17459809 }, { filename: "/espeak-ng-data/voices/!v/Hugo", start: 17459809, end: 17460187 }, { filename: "/espeak-ng-data/voices/!v/Jacky", start: 17460187, end: 17460454 }, { filename: "/espeak-ng-data/voices/!v/Lee", start: 17460454, end: 17460792 }, { filename: "/espeak-ng-data/voices/!v/Marco", start: 17460792, end: 17461259 }, { filename: "/espeak-ng-data/voices/!v/Mario", start: 17461259, end: 17461529 }, { filename: "/espeak-ng-data/voices/!v/Michael", start: 17461529, end: 17461799 }, { filename: "/espeak-ng-data/voices/!v/Mike", start: 17461799, end: 17461911 }, { filename: "/espeak-ng-data/voices/!v/Mr serious", start: 17461911, end: 17465104 }, { filename: "/espeak-ng-data/voices/!v/Nguyen", start: 17465104, end: 17465384 }, { filename: "/espeak-ng-data/voices/!v/Reed", start: 17465384, end: 17465586 }, { filename: "/espeak-ng-data/voices/!v/RicishayMax", start: 17465586, end: 17465819 }, { filename: "/espeak-ng-data/voices/!v/RicishayMax2", start: 17465819, end: 17466254 }, { filename: "/espeak-ng-data/voices/!v/RicishayMax3", start: 17466254, end: 17466689 }, { filename: "/espeak-ng-data/voices/!v/Storm", start: 17466689, end: 17467109 }, { filename: "/espeak-ng-data/voices/!v/Tweaky", start: 17467109, end: 17470298 }, { filename: "/espeak-ng-data/voices/!v/UniRobot", start: 17470298, end: 17470715 }, { filename: "/espeak-ng-data/voices/!v/adam", start: 17470715, end: 17470790 }, { filename: "/espeak-ng-data/voices/!v/anika", start: 17470790, end: 17471283 }, { filename: "/espeak-ng-data/voices/!v/anikaRobot", start: 17471283, end: 17471795 }, { filename: "/espeak-ng-data/voices/!v/announcer", start: 17471795, end: 17472095 }, { filename: "/espeak-ng-data/voices/!v/antonio", start: 17472095, end: 17472476 }, { filename: "/espeak-ng-data/voices/!v/aunty", start: 17472476, end: 17472834 }, { filename: "/espeak-ng-data/voices/!v/belinda", start: 17472834, end: 17473174 }, { filename: "/espeak-ng-data/voices/!v/benjamin", start: 17473174, end: 17473375 }, { filename: "/espeak-ng-data/voices/!v/boris", start: 17473375, end: 17473599 }, { filename: "/espeak-ng-data/voices/!v/caleb", start: 17473599, end: 17473656 }, { filename: "/espeak-ng-data/voices/!v/croak", start: 17473656, end: 17473749 }, { filename: "/espeak-ng-data/voices/!v/david", start: 17473749, end: 17473861 }, { filename: "/espeak-ng-data/voices/!v/ed", start: 17473861, end: 17474148 }, { filename: "/espeak-ng-data/voices/!v/edward", start: 17474148, end: 17474299 }, { filename: "/espeak-ng-data/voices/!v/edward2", start: 17474299, end: 17474451 }, { filename: "/espeak-ng-data/voices/!v/f1", start: 17474451, end: 17474775 }, { filename: "/espeak-ng-data/voices/!v/f2", start: 17474775, end: 17475132 }, { filename: "/espeak-ng-data/voices/!v/f3", start: 17475132, end: 17475507 }, { filename: "/espeak-ng-data/voices/!v/f4", start: 17475507, end: 17475857 }, { filename: "/espeak-ng-data/voices/!v/f5", start: 17475857, end: 17476289 }, { filename: "/espeak-ng-data/voices/!v/fast", start: 17476289, end: 17476438 }, { filename: "/espeak-ng-data/voices/!v/grandma", start: 17476438, end: 17476701 }, { filename: "/espeak-ng-data/voices/!v/grandpa", start: 17476701, end: 17476957 }, { filename: "/espeak-ng-data/voices/!v/gustave", start: 17476957, end: 17477210 }, { filename: "/espeak-ng-data/voices/!v/ian", start: 17477210, end: 17480378 }, { filename: "/espeak-ng-data/voices/!v/iven", start: 17480378, end: 17480639 }, { filename: "/espeak-ng-data/voices/!v/iven2", start: 17480639, end: 17480918 }, { filename: "/espeak-ng-data/voices/!v/iven3", start: 17480918, end: 17481180 }, { filename: "/espeak-ng-data/voices/!v/iven4", start: 17481180, end: 17481441 }, { filename: "/espeak-ng-data/voices/!v/john", start: 17481441, end: 17484627 }, { filename: "/espeak-ng-data/voices/!v/kaukovalta", start: 17484627, end: 17484988 }, { filename: "/espeak-ng-data/voices/!v/klatt", start: 17484988, end: 17485026 }, { filename: "/espeak-ng-data/voices/!v/klatt2", start: 17485026, end: 17485064 }, { filename: "/espeak-ng-data/voices/!v/klatt3", start: 17485064, end: 17485103 }, { filename: "/espeak-ng-data/voices/!v/klatt4", start: 17485103, end: 17485142 }, { filename: "/espeak-ng-data/voices/!v/klatt5", start: 17485142, end: 17485181 }, { filename: "/espeak-ng-data/voices/!v/klatt6", start: 17485181, end: 17485220 }, { filename: "/espeak-ng-data/voices/!v/linda", start: 17485220, end: 17485570 }, { filename: "/espeak-ng-data/voices/!v/m1", start: 17485570, end: 17485905 }, { filename: "/espeak-ng-data/voices/!v/m2", start: 17485905, end: 17486169 }, { filename: "/espeak-ng-data/voices/!v/m3", start: 17486169, end: 17486469 }, { filename: "/espeak-ng-data/voices/!v/m4", start: 17486469, end: 17486759 }, { filename: "/espeak-ng-data/voices/!v/m5", start: 17486759, end: 17487021 }, { filename: "/espeak-ng-data/voices/!v/m6", start: 17487021, end: 17487209 }, { filename: "/espeak-ng-data/voices/!v/m7", start: 17487209, end: 17487463 }, { filename: "/espeak-ng-data/voices/!v/m8", start: 17487463, end: 17487747 }, { filename: "/espeak-ng-data/voices/!v/marcelo", start: 17487747, end: 17487998 }, { filename: "/espeak-ng-data/voices/!v/max", start: 17487998, end: 17488223 }, { filename: "/espeak-ng-data/voices/!v/michel", start: 17488223, end: 17488627 }, { filename: "/espeak-ng-data/voices/!v/miguel", start: 17488627, end: 17489009 }, { filename: "/espeak-ng-data/voices/!v/mike2", start: 17489009, end: 17489197 }, { filename: "/espeak-ng-data/voices/!v/norbert", start: 17489197, end: 17492386 }, { filename: "/espeak-ng-data/voices/!v/pablo", start: 17492386, end: 17495528 }, { filename: "/espeak-ng-data/voices/!v/paul", start: 17495528, end: 17495812 }, { filename: "/espeak-ng-data/voices/!v/pedro", start: 17495812, end: 17496164 }, { filename: "/espeak-ng-data/voices/!v/quincy", start: 17496164, end: 17496518 }, { filename: "/espeak-ng-data/voices/!v/rob", start: 17496518, end: 17496783 }, { filename: "/espeak-ng-data/voices/!v/robert", start: 17496783, end: 17497057 }, { filename: "/espeak-ng-data/voices/!v/robosoft", start: 17497057, end: 17497508 }, { filename: "/espeak-ng-data/voices/!v/robosoft2", start: 17497508, end: 17497962 }, { filename: "/espeak-ng-data/voices/!v/robosoft3", start: 17497962, end: 17498417 }, { filename: "/espeak-ng-data/voices/!v/robosoft4", start: 17498417, end: 17498864 }, { filename: "/espeak-ng-data/voices/!v/robosoft5", start: 17498864, end: 17499309 }, { filename: "/espeak-ng-data/voices/!v/robosoft6", start: 17499309, end: 17499596 }, { filename: "/espeak-ng-data/voices/!v/robosoft7", start: 17499596, end: 17500006 }, { filename: "/espeak-ng-data/voices/!v/robosoft8", start: 17500006, end: 17500249 }, { filename: "/espeak-ng-data/voices/!v/sandro", start: 17500249, end: 17500779 }, { filename: "/espeak-ng-data/voices/!v/shelby", start: 17500779, end: 17501059 }, { filename: "/espeak-ng-data/voices/!v/steph", start: 17501059, end: 17501423 }, { filename: "/espeak-ng-data/voices/!v/steph2", start: 17501423, end: 17501790 }, { filename: "/espeak-ng-data/voices/!v/steph3", start: 17501790, end: 17502167 }, { filename: "/espeak-ng-data/voices/!v/travis", start: 17502167, end: 17502550 }, { filename: "/espeak-ng-data/voices/!v/victor", start: 17502550, end: 17502803 }, { filename: "/espeak-ng-data/voices/!v/whisper", start: 17502803, end: 17502989 }, { filename: "/espeak-ng-data/voices/!v/whisperf", start: 17502989, end: 17503381 }, { filename: "/espeak-ng-data/voices/!v/zac", start: 17503381, end: 17503656 }, { filename: "/espeak-ng-data/voices/mb/mb-af1", start: 17503656, end: 17503744 }, { filename: "/espeak-ng-data/voices/mb/mb-af1-en", start: 17503744, end: 17503827 }, { filename: "/espeak-ng-data/voices/mb/mb-ar1", start: 17503827, end: 17503911 }, { filename: "/espeak-ng-data/voices/mb/mb-ar2", start: 17503911, end: 17503995 }, { filename: "/espeak-ng-data/voices/mb/mb-br1", start: 17503995, end: 17504127 }, { filename: "/espeak-ng-data/voices/mb/mb-br2", start: 17504127, end: 17504263 }, { filename: "/espeak-ng-data/voices/mb/mb-br3", start: 17504263, end: 17504395 }, { filename: "/espeak-ng-data/voices/mb/mb-br4", start: 17504395, end: 17504531 }, { filename: "/espeak-ng-data/voices/mb/mb-ca1", start: 17504531, end: 17504636 }, { filename: "/espeak-ng-data/voices/mb/mb-ca2", start: 17504636, end: 17504741 }, { filename: "/espeak-ng-data/voices/mb/mb-cn1", start: 17504741, end: 17504833 }, { filename: "/espeak-ng-data/voices/mb/mb-cr1", start: 17504833, end: 17504944 }, { filename: "/espeak-ng-data/voices/mb/mb-cz1", start: 17504944, end: 17505014 }, { filename: "/espeak-ng-data/voices/mb/mb-cz2", start: 17505014, end: 17505096 }, { filename: "/espeak-ng-data/voices/mb/mb-de1", start: 17505096, end: 17505240 }, { filename: "/espeak-ng-data/voices/mb/mb-de1-en", start: 17505240, end: 17505336 }, { filename: "/espeak-ng-data/voices/mb/mb-de2", start: 17505336, end: 17505464 }, { filename: "/espeak-ng-data/voices/mb/mb-de2-en", start: 17505464, end: 17505544 }, { filename: "/espeak-ng-data/voices/mb/mb-de3", start: 17505544, end: 17505643 }, { filename: "/espeak-ng-data/voices/mb/mb-de3-en", start: 17505643, end: 17505739 }, { filename: "/espeak-ng-data/voices/mb/mb-de4", start: 17505739, end: 17505868 }, { filename: "/espeak-ng-data/voices/mb/mb-de4-en", start: 17505868, end: 17505949 }, { filename: "/espeak-ng-data/voices/mb/mb-de5", start: 17505949, end: 17506185 }, { filename: "/espeak-ng-data/voices/mb/mb-de5-en", start: 17506185, end: 17506275 }, { filename: "/espeak-ng-data/voices/mb/mb-de6", start: 17506275, end: 17506397 }, { filename: "/espeak-ng-data/voices/mb/mb-de6-en", start: 17506397, end: 17506471 }, { filename: "/espeak-ng-data/voices/mb/mb-de6-grc", start: 17506471, end: 17506554 }, { filename: "/espeak-ng-data/voices/mb/mb-de7", start: 17506554, end: 17506704 }, { filename: "/espeak-ng-data/voices/mb/mb-de8", start: 17506704, end: 17506775 }, { filename: "/espeak-ng-data/voices/mb/mb-ee1", start: 17506775, end: 17506872 }, { filename: "/espeak-ng-data/voices/mb/mb-en1", start: 17506872, end: 17507003 }, { filename: "/espeak-ng-data/voices/mb/mb-es1", start: 17507003, end: 17507117 }, { filename: "/espeak-ng-data/voices/mb/mb-es2", start: 17507117, end: 17507225 }, { filename: "/espeak-ng-data/voices/mb/mb-es3", start: 17507225, end: 17507329 }, { filename: "/espeak-ng-data/voices/mb/mb-es4", start: 17507329, end: 17507417 }, { filename: "/espeak-ng-data/voices/mb/mb-fr1", start: 17507417, end: 17507583 }, { filename: "/espeak-ng-data/voices/mb/mb-fr1-en", start: 17507583, end: 17507687 }, { filename: "/espeak-ng-data/voices/mb/mb-fr2", start: 17507687, end: 17507790 }, { filename: "/espeak-ng-data/voices/mb/mb-fr3", start: 17507790, end: 17507890 }, { filename: "/espeak-ng-data/voices/mb/mb-fr4", start: 17507890, end: 17508017 }, { filename: "/espeak-ng-data/voices/mb/mb-fr4-en", start: 17508017, end: 17508124 }, { filename: "/espeak-ng-data/voices/mb/mb-fr5", start: 17508124, end: 17508224 }, { filename: "/espeak-ng-data/voices/mb/mb-fr6", start: 17508224, end: 17508324 }, { filename: "/espeak-ng-data/voices/mb/mb-fr7", start: 17508324, end: 17508407 }, { filename: "/espeak-ng-data/voices/mb/mb-gr1", start: 17508407, end: 17508501 }, { filename: "/espeak-ng-data/voices/mb/mb-gr2", start: 17508501, end: 17508595 }, { filename: "/espeak-ng-data/voices/mb/mb-gr2-en", start: 17508595, end: 17508683 }, { filename: "/espeak-ng-data/voices/mb/mb-hb1", start: 17508683, end: 17508751 }, { filename: "/espeak-ng-data/voices/mb/mb-hb2", start: 17508751, end: 17508834 }, { filename: "/espeak-ng-data/voices/mb/mb-hu1", start: 17508834, end: 17508936 }, { filename: "/espeak-ng-data/voices/mb/mb-hu1-en", start: 17508936, end: 17509033 }, { filename: "/espeak-ng-data/voices/mb/mb-ic1", start: 17509033, end: 17509121 }, { filename: "/espeak-ng-data/voices/mb/mb-id1", start: 17509121, end: 17509222 }, { filename: "/espeak-ng-data/voices/mb/mb-in1", start: 17509222, end: 17509291 }, { filename: "/espeak-ng-data/voices/mb/mb-in2", start: 17509291, end: 17509376 }, { filename: "/espeak-ng-data/voices/mb/mb-ir1", start: 17509376, end: 17510129 }, { filename: "/espeak-ng-data/voices/mb/mb-it1", start: 17510129, end: 17510213 }, { filename: "/espeak-ng-data/voices/mb/mb-it2", start: 17510213, end: 17510300 }, { filename: "/espeak-ng-data/voices/mb/mb-it3", start: 17510300, end: 17510442 }, { filename: "/espeak-ng-data/voices/mb/mb-it4", start: 17510442, end: 17510587 }, { filename: "/espeak-ng-data/voices/mb/mb-jp1", start: 17510587, end: 17510658 }, { filename: "/espeak-ng-data/voices/mb/mb-jp2", start: 17510658, end: 17510759 }, { filename: "/espeak-ng-data/voices/mb/mb-jp3", start: 17510759, end: 17510846 }, { filename: "/espeak-ng-data/voices/mb/mb-la1", start: 17510846, end: 17510929 }, { filename: "/espeak-ng-data/voices/mb/mb-lt1", start: 17510929, end: 17511016 }, { filename: "/espeak-ng-data/voices/mb/mb-lt2", start: 17511016, end: 17511103 }, { filename: "/espeak-ng-data/voices/mb/mb-ma1", start: 17511103, end: 17511201 }, { filename: "/espeak-ng-data/voices/mb/mb-mx1", start: 17511201, end: 17511321 }, { filename: "/espeak-ng-data/voices/mb/mb-mx2", start: 17511321, end: 17511441 }, { filename: "/espeak-ng-data/voices/mb/mb-nl1", start: 17511441, end: 17511510 }, { filename: "/espeak-ng-data/voices/mb/mb-nl2", start: 17511510, end: 17511606 }, { filename: "/espeak-ng-data/voices/mb/mb-nl2-en", start: 17511606, end: 17511697 }, { filename: "/espeak-ng-data/voices/mb/mb-nl3", start: 17511697, end: 17511782 }, { filename: "/espeak-ng-data/voices/mb/mb-nz1", start: 17511782, end: 17511850 }, { filename: "/espeak-ng-data/voices/mb/mb-pl1", start: 17511850, end: 17511949 }, { filename: "/espeak-ng-data/voices/mb/mb-pl1-en", start: 17511949, end: 17512031 }, { filename: "/espeak-ng-data/voices/mb/mb-pt1", start: 17512031, end: 17512162 }, { filename: "/espeak-ng-data/voices/mb/mb-ro1", start: 17512162, end: 17512249 }, { filename: "/espeak-ng-data/voices/mb/mb-ro1-en", start: 17512249, end: 17512330 }, { filename: "/espeak-ng-data/voices/mb/mb-sw1", start: 17512330, end: 17512428 }, { filename: "/espeak-ng-data/voices/mb/mb-sw1-en", start: 17512428, end: 17512521 }, { filename: "/espeak-ng-data/voices/mb/mb-sw2", start: 17512521, end: 17512623 }, { filename: "/espeak-ng-data/voices/mb/mb-sw2-en", start: 17512623, end: 17512722 }, { filename: "/espeak-ng-data/voices/mb/mb-tl1", start: 17512722, end: 17512807 }, { filename: "/espeak-ng-data/voices/mb/mb-tr1", start: 17512807, end: 17512892 }, { filename: "/espeak-ng-data/voices/mb/mb-tr2", start: 17512892, end: 17513006 }, { filename: "/espeak-ng-data/voices/mb/mb-us1", start: 17513006, end: 17513176 }, { filename: "/espeak-ng-data/voices/mb/mb-us2", start: 17513176, end: 17513354 }, { filename: "/espeak-ng-data/voices/mb/mb-us3", start: 17513354, end: 17513534 }, { filename: "/espeak-ng-data/voices/mb/mb-vz1", start: 17513534, end: 17513678 }, { filename: "/espeak-ng-data/yue_dict", start: 17513678, end: 18077249 }], remote_package_size: 18077249 });
    })();
    var h = Object.assign({}, g), y = [], c = "./this.program", l = (P, gA) => {
      throw gA;
    }, t = "";
    function f(P) {
      return g.locateFile ? g.locateFile(P, t) : t + P;
    }
    var u, p;
    if (U) {
      var b = __viteBrowserExternal || __CJS__import__3__;
      t = __dirname + "/", p = (P) => {
        P = LI(P) ? new URL(P) : P;
        var gA = b.readFileSync(P);
        return gA;
      }, u = async (P, gA = !0) => {
        P = LI(P) ? new URL(P) : P;
        var wA = b.readFileSync(P, gA ? void 0 : "utf8");
        return wA;
      }, !g.thisProgram && process.argv.length > 1 && (c = process.argv[1].replace(/\\/g, "/")), y = process.argv.slice(2), l = (P, gA) => {
        throw process.exitCode = P, gA;
      };
    } else (L || S) && (S ? t = self.location.href : typeof document < "u" && document.currentScript && (t = document.currentScript.src), A && (t = A), t.startsWith("blob:") ? t = "" : t = t.substr(0, t.replace(/[?#].*/, "").lastIndexOf("/") + 1), S && (p = (P) => {
      var gA = new XMLHttpRequest();
      return gA.open("GET", P, !1), gA.responseType = "arraybuffer", gA.send(null), new Uint8Array(gA.response);
    }), u = async (P) => {
      if (LI(P))
        return new Promise((wA, hA) => {
          var pA = new XMLHttpRequest();
          pA.open("GET", P, !0), pA.responseType = "arraybuffer", pA.onload = () => {
            if (pA.status == 200 || pA.status == 0 && pA.response) {
              wA(pA.response);
              return;
            }
            hA(pA.status);
          }, pA.onerror = hA, pA.send(null);
        });
      var gA = await fetch(P, { credentials: "same-origin" });
      if (gA.ok)
        return gA.arrayBuffer();
      throw new Error(gA.status + " : " + gA.url);
    });
    var $ = g.print || console.log.bind(console), X = g.printErr || console.error.bind(console);
    Object.assign(g, h), h = null, g.arguments && (y = g.arguments), g.thisProgram && (c = g.thisProgram);
    var _ = g.wasmBinary, v, IA = !1, RA, lA, HA, OA, rA, jA;
    function XA() {
      var P = v.buffer;
      g.HEAP8 = lA = new Int8Array(P), g.HEAP16 = OA = new Int16Array(P), g.HEAPU8 = HA = new Uint8Array(P), g.HEAPU16 = new Uint16Array(P), g.HEAP32 = rA = new Int32Array(P), g.HEAPU32 = jA = new Uint32Array(P), g.HEAPF32 = new Float32Array(P), g.HEAPF64 = new Float64Array(P);
    }
    var bA = [], mA = [], DI = [], vA = [];
    function FI() {
      if (g.preRun)
        for (typeof g.preRun == "function" && (g.preRun = [g.preRun]); g.preRun.length; )
          VA(g.preRun.shift());
      iI(bA);
    }
    function RI() {
      !g.noFSInit && !iA.initialized && iA.init(), iA.ignorePermissions = !1, iI(mA);
    }
    function cA() {
      iI(DI);
    }
    function sA() {
      if (g.postRun)
        for (typeof g.postRun == "function" && (g.postRun = [g.postRun]); g.postRun.length; )
          GI(g.postRun.shift());
      iI(vA);
    }
    function VA(P) {
      bA.unshift(P);
    }
    function gI(P) {
      mA.unshift(P);
    }
    function GI(P) {
      vA.unshift(P);
    }
    var SI = 0, tA = null;
    function JI(P) {
      SI++, g.monitorRunDependencies?.(SI);
    }
    function oI(P) {
      if (SI--, g.monitorRunDependencies?.(SI), SI == 0 && tA) {
        var gA = tA;
        tA = null, gA();
      }
    }
    function qA(P) {
      g.onAbort?.(P), P = "Aborted(" + P + ")", X(P), IA = !0, P += ". Build with -sASSERTIONS for more info.";
      var gA = new WebAssembly.RuntimeError(P);
      throw i(gA), gA;
    }
    var $A = "data:application/octet-stream;base64,", aI = (P) => P.startsWith($A), LI = (P) => P.startsWith("file://");
    function cI() {
      var P = "piper_phonemize.wasm";
      return aI(P) ? P : f(P);
    }
    var jI;
    function rI(P) {
      if (P == jI && _)
        return new Uint8Array(_);
      if (p)
        return p(P);
      throw "both async and sync fetching of the wasm failed";
    }
    async function XI(P) {
      if (!_)
        try {
          var gA = await u(P);
          return new Uint8Array(gA);
        } catch {
        }
      return rI(P);
    }
    async function BC(P, gA) {
      try {
        var wA = await XI(P), hA = await WebAssembly.instantiate(wA, gA);
        return hA;
      } catch (pA) {
        X(`failed to asynchronously prepare wasm: ${pA}`), qA(pA);
      }
    }
    async function uI(P, gA, wA) {
      if (!P && typeof WebAssembly.instantiateStreaming == "function" && !aI(gA) && !LI(gA) && !U && typeof fetch == "function")
        try {
          var hA = fetch(gA, { credentials: "same-origin" }), pA = await WebAssembly.instantiateStreaming(hA, wA);
          return pA;
        } catch (CI) {
          X(`wasm streaming compile failed: ${CI}`), X("falling back to ArrayBuffer instantiation");
        }
      return BC(gA, wA);
    }
    function IC() {
      return { a: KI };
    }
    async function NA() {
      function P(pA, CI) {
        return qI = pA.exports, v = qI.w, XA(), gI(qI.x), oI(), qI;
      }
      JI();
      function gA(pA) {
        P(pA.instance);
      }
      var wA = IC();
      if (g.instantiateWasm)
        try {
          return g.instantiateWasm(wA, P);
        } catch (pA) {
          X(`Module.instantiateWasm callback failed with error: ${pA}`), i(pA);
        }
      jI ??= cI();
      try {
        var hA = await uI(_, jI, wA);
        return gA(hA), hA;
      } catch (pA) {
        i(pA);
        return;
      }
    }
    var eA, aA;
    class II {
      name = "ExitStatus";
      constructor(gA) {
        this.message = `Program terminated with exit(${gA})`, this.status = gA;
      }
    }
    var iI = (P) => {
      for (; P.length > 0; )
        P.shift()(g);
    };
    g.noExitRuntime;
    var YI = typeof TextDecoder < "u" ? new TextDecoder() : void 0, lI = (P, gA = 0, wA = NaN) => {
      for (var hA = gA + wA, pA = gA; P[pA] && !(pA >= hA); ) ++pA;
      if (pA - gA > 16 && P.buffer && YI)
        return YI.decode(P.subarray(gA, pA));
      for (var CI = ""; gA < pA; ) {
        var fA = P[gA++];
        if (!(fA & 128)) {
          CI += String.fromCharCode(fA);
          continue;
        }
        var NI = P[gA++] & 63;
        if ((fA & 224) == 192) {
          CI += String.fromCharCode((fA & 31) << 6 | NI);
          continue;
        }
        var tI = P[gA++] & 63;
        if ((fA & 240) == 224 ? fA = (fA & 15) << 12 | NI << 6 | tI : fA = (fA & 7) << 18 | NI << 12 | tI << 6 | P[gA++] & 63, fA < 65536)
          CI += String.fromCharCode(fA);
        else {
          var MC = fA - 65536;
          CI += String.fromCharCode(55296 | MC >> 10, 56320 | MC & 1023);
        }
      }
      return CI;
    }, bI = (P, gA) => P ? lI(HA, P, gA) : "", PI = (P, gA, wA, hA) => qA(`Assertion failed: ${bI(P)}, at: ` + [gA ? bI(gA) : "unknown filename", wA, hA ? bI(hA) : "unknown function"]);
    class VI {
      constructor(gA) {
        this.excPtr = gA, this.ptr = gA - 24;
      }
      set_type(gA) {
        jA[this.ptr + 4 >> 2] = gA;
      }
      get_type() {
        return jA[this.ptr + 4 >> 2];
      }
      set_destructor(gA) {
        jA[this.ptr + 8 >> 2] = gA;
      }
      get_destructor() {
        return jA[this.ptr + 8 >> 2];
      }
      set_caught(gA) {
        gA = gA ? 1 : 0, lA[this.ptr + 12] = gA;
      }
      get_caught() {
        return lA[this.ptr + 12] != 0;
      }
      set_rethrown(gA) {
        gA = gA ? 1 : 0, lA[this.ptr + 13] = gA;
      }
      get_rethrown() {
        return lA[this.ptr + 13] != 0;
      }
      init(gA, wA) {
        this.set_adjusted_ptr(0), this.set_type(gA), this.set_destructor(wA);
      }
      set_adjusted_ptr(gA) {
        jA[this.ptr + 16 >> 2] = gA;
      }
      get_adjusted_ptr() {
        return jA[this.ptr + 16 >> 2];
      }
    }
    var tC = 0, mC = (P, gA, wA) => {
      var hA = new VI(P);
      throw hA.init(gA, wA), tC = P, tC;
    }, Vg = () => {
      var P = rA[+iC.varargs >> 2];
      return iC.varargs += 4, P;
    }, TC = Vg, ZC = { isAbs: (P) => P.charAt(0) === "/", splitPath: (P) => {
      var gA = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
      return gA.exec(P).slice(1);
    }, normalizeArray: (P, gA) => {
      for (var wA = 0, hA = P.length - 1; hA >= 0; hA--) {
        var pA = P[hA];
        pA === "." ? P.splice(hA, 1) : pA === ".." ? (P.splice(hA, 1), wA++) : wA && (P.splice(hA, 1), wA--);
      }
      if (gA)
        for (; wA; wA--)
          P.unshift("..");
      return P;
    }, normalize: (P) => {
      var gA = ZC.isAbs(P), wA = P.substr(-1) === "/";
      return P = ZC.normalizeArray(P.split("/").filter((hA) => !!hA), !gA).join("/"), !P && !gA && (P = "."), P && wA && (P += "/"), (gA ? "/" : "") + P;
    }, dirname: (P) => {
      var gA = ZC.splitPath(P), wA = gA[0], hA = gA[1];
      return !wA && !hA ? "." : (hA && (hA = hA.substr(0, hA.length - 1)), wA + hA);
    }, basename: (P) => {
      if (P === "/") return "/";
      P = ZC.normalize(P), P = P.replace(/\/$/, "");
      var gA = P.lastIndexOf("/");
      return gA === -1 ? P : P.substr(gA + 1);
    }, join: (...P) => ZC.normalize(P.join("/")), join2: (P, gA) => ZC.normalize(P + "/" + gA) }, gQ = () => {
      if (typeof crypto == "object" && typeof crypto.getRandomValues == "function")
        return (hA) => crypto.getRandomValues(hA);
      if (U)
        try {
          var P = __viteBrowserExternal || __CJS__import__3__, gA = P.randomFillSync;
          if (gA)
            return (hA) => P.randomFillSync(hA);
          var wA = P.randomBytes;
          return (hA) => (hA.set(wA(hA.byteLength)), hA);
        } catch {
        }
      qA("initRandomDevice");
    }, QQ = (P) => (QQ = gQ())(P), aQ = { resolve: (...P) => {
      for (var gA = "", wA = !1, hA = P.length - 1; hA >= -1 && !wA; hA--) {
        var pA = hA >= 0 ? P[hA] : iA.cwd();
        if (typeof pA != "string")
          throw new TypeError("Arguments to path.resolve must be strings");
        if (!pA)
          return "";
        gA = pA + "/" + gA, wA = ZC.isAbs(pA);
      }
      return gA = ZC.normalizeArray(gA.split("/").filter((CI) => !!CI), !wA).join("/"), (wA ? "/" : "") + gA || ".";
    }, relative: (P, gA) => {
      P = aQ.resolve(P).substr(1), gA = aQ.resolve(gA).substr(1);
      function wA(MC) {
        for (var aC = 0; aC < MC.length && MC[aC] === ""; aC++)
          ;
        for (var OI = MC.length - 1; OI >= 0 && MC[OI] === ""; OI--)
          ;
        return aC > OI ? [] : MC.slice(aC, OI - aC + 1);
      }
      for (var hA = wA(P.split("/")), pA = wA(gA.split("/")), CI = Math.min(hA.length, pA.length), fA = CI, NI = 0; NI < CI; NI++)
        if (hA[NI] !== pA[NI]) {
          fA = NI;
          break;
        }
      for (var tI = [], NI = fA; NI < hA.length; NI++)
        tI.push("..");
      return tI = tI.concat(pA.slice(fA)), tI.join("/");
    } }, QB = [], UQ = (P) => {
      for (var gA = 0, wA = 0; wA < P.length; ++wA) {
        var hA = P.charCodeAt(wA);
        hA <= 127 ? gA++ : hA <= 2047 ? gA += 2 : hA >= 55296 && hA <= 57343 ? (gA += 4, ++wA) : gA += 3;
      }
      return gA;
    }, qQ = (P, gA, wA, hA) => {
      if (!(hA > 0)) return 0;
      for (var pA = wA, CI = wA + hA - 1, fA = 0; fA < P.length; ++fA) {
        var NI = P.charCodeAt(fA);
        if (NI >= 55296 && NI <= 57343) {
          var tI = P.charCodeAt(++fA);
          NI = 65536 + ((NI & 1023) << 10) | tI & 1023;
        }
        if (NI <= 127) {
          if (wA >= CI) break;
          gA[wA++] = NI;
        } else if (NI <= 2047) {
          if (wA + 1 >= CI) break;
          gA[wA++] = 192 | NI >> 6, gA[wA++] = 128 | NI & 63;
        } else if (NI <= 65535) {
          if (wA + 2 >= CI) break;
          gA[wA++] = 224 | NI >> 12, gA[wA++] = 128 | NI >> 6 & 63, gA[wA++] = 128 | NI & 63;
        } else {
          if (wA + 3 >= CI) break;
          gA[wA++] = 240 | NI >> 18, gA[wA++] = 128 | NI >> 12 & 63, gA[wA++] = 128 | NI >> 6 & 63, gA[wA++] = 128 | NI & 63;
        }
      }
      return gA[wA] = 0, wA - pA;
    };
    function jC(P, gA, wA) {
      var hA = UQ(P) + 1, pA = new Array(hA), CI = qQ(P, pA, 0, pA.length);
      return pA.length = CI, pA;
    }
    var iB = () => {
      if (!QB.length) {
        var P = null;
        if (U) {
          var gA = 256, wA = Buffer.alloc(gA), hA = 0, pA = process.stdin.fd;
          try {
            hA = b.readSync(pA, wA, 0, gA);
          } catch (CI) {
            if (CI.toString().includes("EOF")) hA = 0;
            else throw CI;
          }
          hA > 0 && (P = wA.slice(0, hA).toString("utf-8"));
        } else typeof window < "u" && typeof window.prompt == "function" && (P = window.prompt("Input: "), P !== null && (P += `
`));
        if (!P)
          return null;
        QB = jC(P);
      }
      return QB.shift();
    }, NQ = { ttys: [], init() {
    }, shutdown() {
    }, register(P, gA) {
      NQ.ttys[P] = { input: [], output: [], ops: gA }, iA.registerDevice(P, NQ.stream_ops);
    }, stream_ops: { open(P) {
      var gA = NQ.ttys[P.node.rdev];
      if (!gA)
        throw new iA.ErrnoError(43);
      P.tty = gA, P.seekable = !1;
    }, close(P) {
      P.tty.ops.fsync(P.tty);
    }, fsync(P) {
      P.tty.ops.fsync(P.tty);
    }, read(P, gA, wA, hA, pA) {
      if (!P.tty || !P.tty.ops.get_char)
        throw new iA.ErrnoError(60);
      for (var CI = 0, fA = 0; fA < hA; fA++) {
        var NI;
        try {
          NI = P.tty.ops.get_char(P.tty);
        } catch {
          throw new iA.ErrnoError(29);
        }
        if (NI === void 0 && CI === 0)
          throw new iA.ErrnoError(6);
        if (NI == null) break;
        CI++, gA[wA + fA] = NI;
      }
      return CI && (P.node.atime = Date.now()), CI;
    }, write(P, gA, wA, hA, pA) {
      if (!P.tty || !P.tty.ops.put_char)
        throw new iA.ErrnoError(60);
      try {
        for (var CI = 0; CI < hA; CI++)
          P.tty.ops.put_char(P.tty, gA[wA + CI]);
      } catch {
        throw new iA.ErrnoError(29);
      }
      return hA && (P.node.mtime = P.node.ctime = Date.now()), CI;
    } }, default_tty_ops: { get_char(P) {
      return iB();
    }, put_char(P, gA) {
      gA === null || gA === 10 ? ($(lI(P.output)), P.output = []) : gA != 0 && P.output.push(gA);
    }, fsync(P) {
      P.output && P.output.length > 0 && ($(lI(P.output)), P.output = []);
    }, ioctl_tcgets(P) {
      return { c_iflag: 25856, c_oflag: 5, c_cflag: 191, c_lflag: 35387, c_cc: [3, 28, 127, 21, 4, 0, 1, 0, 17, 19, 26, 0, 18, 15, 23, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
    }, ioctl_tcsets(P, gA, wA) {
      return 0;
    }, ioctl_tiocgwinsz(P) {
      return [24, 80];
    } }, default_tty1_ops: { put_char(P, gA) {
      gA === null || gA === 10 ? (X(lI(P.output)), P.output = []) : gA != 0 && P.output.push(gA);
    }, fsync(P) {
      P.output && P.output.length > 0 && (X(lI(P.output)), P.output = []);
    } } }, vQ = (P) => {
      qA();
    }, bC = { ops_table: null, mount(P) {
      return bC.createNode(null, "/", 16895, 0);
    }, createNode(P, gA, wA, hA) {
      if (iA.isBlkdev(wA) || iA.isFIFO(wA))
        throw new iA.ErrnoError(63);
      bC.ops_table ||= { dir: { node: { getattr: bC.node_ops.getattr, setattr: bC.node_ops.setattr, lookup: bC.node_ops.lookup, mknod: bC.node_ops.mknod, rename: bC.node_ops.rename, unlink: bC.node_ops.unlink, rmdir: bC.node_ops.rmdir, readdir: bC.node_ops.readdir, symlink: bC.node_ops.symlink }, stream: { llseek: bC.stream_ops.llseek } }, file: { node: { getattr: bC.node_ops.getattr, setattr: bC.node_ops.setattr }, stream: { llseek: bC.stream_ops.llseek, read: bC.stream_ops.read, write: bC.stream_ops.write, allocate: bC.stream_ops.allocate, mmap: bC.stream_ops.mmap, msync: bC.stream_ops.msync } }, link: { node: { getattr: bC.node_ops.getattr, setattr: bC.node_ops.setattr, readlink: bC.node_ops.readlink }, stream: {} }, chrdev: { node: { getattr: bC.node_ops.getattr, setattr: bC.node_ops.setattr }, stream: iA.chrdev_stream_ops } };
      var pA = iA.createNode(P, gA, wA, hA);
      return iA.isDir(pA.mode) ? (pA.node_ops = bC.ops_table.dir.node, pA.stream_ops = bC.ops_table.dir.stream, pA.contents = {}) : iA.isFile(pA.mode) ? (pA.node_ops = bC.ops_table.file.node, pA.stream_ops = bC.ops_table.file.stream, pA.usedBytes = 0, pA.contents = null) : iA.isLink(pA.mode) ? (pA.node_ops = bC.ops_table.link.node, pA.stream_ops = bC.ops_table.link.stream) : iA.isChrdev(pA.mode) && (pA.node_ops = bC.ops_table.chrdev.node, pA.stream_ops = bC.ops_table.chrdev.stream), pA.atime = pA.mtime = pA.ctime = Date.now(), P && (P.contents[gA] = pA, P.atime = P.mtime = P.ctime = pA.atime), pA;
    }, getFileDataAsTypedArray(P) {
      return P.contents ? P.contents.subarray ? P.contents.subarray(0, P.usedBytes) : new Uint8Array(P.contents) : new Uint8Array(0);
    }, expandFileStorage(P, gA) {
      var wA = P.contents ? P.contents.length : 0;
      if (!(wA >= gA)) {
        var hA = 1024 * 1024;
        gA = Math.max(gA, wA * (wA < hA ? 2 : 1.125) >>> 0), wA != 0 && (gA = Math.max(gA, 256));
        var pA = P.contents;
        P.contents = new Uint8Array(gA), P.usedBytes > 0 && P.contents.set(pA.subarray(0, P.usedBytes), 0);
      }
    }, resizeFileStorage(P, gA) {
      if (P.usedBytes != gA)
        if (gA == 0)
          P.contents = null, P.usedBytes = 0;
        else {
          var wA = P.contents;
          P.contents = new Uint8Array(gA), wA && P.contents.set(wA.subarray(0, Math.min(gA, P.usedBytes))), P.usedBytes = gA;
        }
    }, node_ops: { getattr(P) {
      var gA = {};
      return gA.dev = iA.isChrdev(P.mode) ? P.id : 1, gA.ino = P.id, gA.mode = P.mode, gA.nlink = 1, gA.uid = 0, gA.gid = 0, gA.rdev = P.rdev, iA.isDir(P.mode) ? gA.size = 4096 : iA.isFile(P.mode) ? gA.size = P.usedBytes : iA.isLink(P.mode) ? gA.size = P.link.length : gA.size = 0, gA.atime = new Date(P.atime), gA.mtime = new Date(P.mtime), gA.ctime = new Date(P.ctime), gA.blksize = 4096, gA.blocks = Math.ceil(gA.size / gA.blksize), gA;
    }, setattr(P, gA) {
      for (const wA of ["mode", "atime", "mtime", "ctime"])
        gA[wA] && (P[wA] = gA[wA]);
      gA.size !== void 0 && bC.resizeFileStorage(P, gA.size);
    }, lookup(P, gA) {
      throw bC.doesNotExistError;
    }, mknod(P, gA, wA, hA) {
      return bC.createNode(P, gA, wA, hA);
    }, rename(P, gA, wA) {
      var hA;
      try {
        hA = iA.lookupNode(gA, wA);
      } catch {
      }
      if (hA) {
        if (iA.isDir(P.mode))
          for (var pA in hA.contents)
            throw new iA.ErrnoError(55);
        iA.hashRemoveNode(hA);
      }
      delete P.parent.contents[P.name], gA.contents[wA] = P, P.name = wA, gA.ctime = gA.mtime = P.parent.ctime = P.parent.mtime = Date.now();
    }, unlink(P, gA) {
      delete P.contents[gA], P.ctime = P.mtime = Date.now();
    }, rmdir(P, gA) {
      var wA = iA.lookupNode(P, gA);
      for (var hA in wA.contents)
        throw new iA.ErrnoError(55);
      delete P.contents[gA], P.ctime = P.mtime = Date.now();
    }, readdir(P) {
      return [".", "..", ...Object.keys(P.contents)];
    }, symlink(P, gA, wA) {
      var hA = bC.createNode(P, gA, 41471, 0);
      return hA.link = wA, hA;
    }, readlink(P) {
      if (!iA.isLink(P.mode))
        throw new iA.ErrnoError(28);
      return P.link;
    } }, stream_ops: { read(P, gA, wA, hA, pA) {
      var CI = P.node.contents;
      if (pA >= P.node.usedBytes) return 0;
      var fA = Math.min(P.node.usedBytes - pA, hA);
      if (fA > 8 && CI.subarray)
        gA.set(CI.subarray(pA, pA + fA), wA);
      else
        for (var NI = 0; NI < fA; NI++) gA[wA + NI] = CI[pA + NI];
      return fA;
    }, write(P, gA, wA, hA, pA, CI) {
      if (!hA) return 0;
      var fA = P.node;
      if (fA.mtime = fA.ctime = Date.now(), gA.subarray && (!fA.contents || fA.contents.subarray)) {
        if (CI)
          return fA.contents = gA.subarray(wA, wA + hA), fA.usedBytes = hA, hA;
        if (fA.usedBytes === 0 && pA === 0)
          return fA.contents = gA.slice(wA, wA + hA), fA.usedBytes = hA, hA;
        if (pA + hA <= fA.usedBytes)
          return fA.contents.set(gA.subarray(wA, wA + hA), pA), hA;
      }
      if (bC.expandFileStorage(fA, pA + hA), fA.contents.subarray && gA.subarray)
        fA.contents.set(gA.subarray(wA, wA + hA), pA);
      else
        for (var NI = 0; NI < hA; NI++)
          fA.contents[pA + NI] = gA[wA + NI];
      return fA.usedBytes = Math.max(fA.usedBytes, pA + hA), hA;
    }, llseek(P, gA, wA) {
      var hA = gA;
      if (wA === 1 ? hA += P.position : wA === 2 && iA.isFile(P.node.mode) && (hA += P.node.usedBytes), hA < 0)
        throw new iA.ErrnoError(28);
      return hA;
    }, allocate(P, gA, wA) {
      bC.expandFileStorage(P.node, gA + wA), P.node.usedBytes = Math.max(P.node.usedBytes, gA + wA);
    }, mmap(P, gA, wA, hA, pA) {
      if (!iA.isFile(P.node.mode))
        throw new iA.ErrnoError(43);
      var CI, fA, NI = P.node.contents;
      if (!(pA & 2) && NI && NI.buffer === lA.buffer)
        fA = !1, CI = NI.byteOffset;
      else {
        if (fA = !0, CI = vQ(), !CI)
          throw new iA.ErrnoError(48);
        NI && ((wA > 0 || wA + gA < NI.length) && (NI.subarray ? NI = NI.subarray(wA, wA + gA) : NI = Array.prototype.slice.call(NI, wA, wA + gA)), lA.set(NI, CI));
      }
      return { ptr: CI, allocated: fA };
    }, msync(P, gA, wA, hA, pA) {
      return bC.stream_ops.write(P, gA, 0, hA, wA, !1), 0;
    } } }, tQ = async (P) => {
      var gA = await u(P);
      return new Uint8Array(gA);
    }, _Q = (P, gA, wA, hA, pA, CI) => {
      iA.createDataFile(P, gA, wA, hA, pA, CI);
    }, eQ = g.preloadPlugins || [], BB = (P, gA, wA, hA) => {
      typeof Browser < "u" && Browser.init();
      var pA = !1;
      return eQ.forEach((CI) => {
        pA || CI.canHandle(gA) && (CI.handle(P, gA, wA, hA), pA = !0);
      }), pA;
    }, IQ = (P, gA, wA, hA, pA, CI, fA, NI, tI, MC) => {
      var aC = gA ? aQ.resolve(ZC.join2(P, gA)) : P;
      function OI(NC) {
        function hC(dI) {
          MC?.(), NI || _Q(P, gA, dI, hA, pA, tI), CI?.(), oI();
        }
        BB(NC, aC, hC, () => {
          fA?.(), oI();
        }) || hC(NC);
      }
      JI(), typeof wA == "string" ? tQ(wA).then(OI, fA) : OI(wA);
    }, lQ = (P) => {
      var gA = { r: 0, "r+": 2, w: 577, "w+": 578, a: 1089, "a+": 1090 }, wA = gA[P];
      if (typeof wA > "u")
        throw new Error(`Unknown file open mode: ${P}`);
      return wA;
    }, TI = (P, gA) => {
      var wA = 0;
      return P && (wA |= 365), gA && (wA |= 146), wA;
    }, iA = { root: null, mounts: [], devices: {}, streams: [], nextInode: 1, nameTable: null, currentPath: "/", initialized: !1, ignorePermissions: !0, ErrnoError: class {
      name = "ErrnoError";
      constructor(P) {
        this.errno = P;
      }
    }, filesystems: null, syncFSRequests: 0, readFiles: {}, FSStream: class {
      shared = {};
      get object() {
        return this.node;
      }
      set object(P) {
        this.node = P;
      }
      get isRead() {
        return (this.flags & 2097155) !== 1;
      }
      get isWrite() {
        return (this.flags & 2097155) !== 0;
      }
      get isAppend() {
        return this.flags & 1024;
      }
      get flags() {
        return this.shared.flags;
      }
      set flags(P) {
        this.shared.flags = P;
      }
      get position() {
        return this.shared.position;
      }
      set position(P) {
        this.shared.position = P;
      }
    }, FSNode: class {
      node_ops = {};
      stream_ops = {};
      readMode = 365;
      writeMode = 146;
      mounted = null;
      constructor(P, gA, wA, hA) {
        P || (P = this), this.parent = P, this.mount = P.mount, this.id = iA.nextInode++, this.name = gA, this.mode = wA, this.rdev = hA, this.atime = this.mtime = this.ctime = Date.now();
      }
      get read() {
        return (this.mode & this.readMode) === this.readMode;
      }
      set read(P) {
        P ? this.mode |= this.readMode : this.mode &= ~this.readMode;
      }
      get write() {
        return (this.mode & this.writeMode) === this.writeMode;
      }
      set write(P) {
        P ? this.mode |= this.writeMode : this.mode &= ~this.writeMode;
      }
      get isFolder() {
        return iA.isDir(this.mode);
      }
      get isDevice() {
        return iA.isChrdev(this.mode);
      }
    }, lookupPath(P, gA = {}) {
      if (!P) return { path: "", node: null };
      gA.follow_mount ??= !0, ZC.isAbs(P) || (P = iA.cwd() + "/" + P);
      A: for (var wA = 0; wA < 40; wA++) {
        for (var hA = P.split("/").filter((MC) => !!MC && MC !== "."), pA = iA.root, CI = "/", fA = 0; fA < hA.length; fA++) {
          var NI = fA === hA.length - 1;
          if (NI && gA.parent)
            break;
          if (hA[fA] === "..") {
            CI = ZC.dirname(CI), pA = pA.parent;
            continue;
          }
          CI = ZC.join2(CI, hA[fA]);
          try {
            pA = iA.lookupNode(pA, hA[fA]);
          } catch (MC) {
            if (MC?.errno === 44 && NI && gA.noent_okay)
              return { path: CI };
            throw MC;
          }
          if (iA.isMountpoint(pA) && (!NI || gA.follow_mount) && (pA = pA.mounted.root), iA.isLink(pA.mode) && (!NI || gA.follow)) {
            if (!pA.node_ops.readlink)
              throw new iA.ErrnoError(52);
            var tI = pA.node_ops.readlink(pA);
            ZC.isAbs(tI) || (tI = ZC.dirname(CI) + "/" + tI), P = tI + "/" + hA.slice(fA + 1).join("/");
            continue A;
          }
        }
        return { path: CI, node: pA };
      }
      throw new iA.ErrnoError(32);
    }, getPath(P) {
      for (var gA; ; ) {
        if (iA.isRoot(P)) {
          var wA = P.mount.mountpoint;
          return gA ? wA[wA.length - 1] !== "/" ? `${wA}/${gA}` : wA + gA : wA;
        }
        gA = gA ? `${P.name}/${gA}` : P.name, P = P.parent;
      }
    }, hashName(P, gA) {
      for (var wA = 0, hA = 0; hA < gA.length; hA++)
        wA = (wA << 5) - wA + gA.charCodeAt(hA) | 0;
      return (P + wA >>> 0) % iA.nameTable.length;
    }, hashAddNode(P) {
      var gA = iA.hashName(P.parent.id, P.name);
      P.name_next = iA.nameTable[gA], iA.nameTable[gA] = P;
    }, hashRemoveNode(P) {
      var gA = iA.hashName(P.parent.id, P.name);
      if (iA.nameTable[gA] === P)
        iA.nameTable[gA] = P.name_next;
      else
        for (var wA = iA.nameTable[gA]; wA; ) {
          if (wA.name_next === P) {
            wA.name_next = P.name_next;
            break;
          }
          wA = wA.name_next;
        }
    }, lookupNode(P, gA) {
      var wA = iA.mayLookup(P);
      if (wA)
        throw new iA.ErrnoError(wA);
      for (var hA = iA.hashName(P.id, gA), pA = iA.nameTable[hA]; pA; pA = pA.name_next) {
        var CI = pA.name;
        if (pA.parent.id === P.id && CI === gA)
          return pA;
      }
      return iA.lookup(P, gA);
    }, createNode(P, gA, wA, hA) {
      var pA = new iA.FSNode(P, gA, wA, hA);
      return iA.hashAddNode(pA), pA;
    }, destroyNode(P) {
      iA.hashRemoveNode(P);
    }, isRoot(P) {
      return P === P.parent;
    }, isMountpoint(P) {
      return !!P.mounted;
    }, isFile(P) {
      return (P & 61440) === 32768;
    }, isDir(P) {
      return (P & 61440) === 16384;
    }, isLink(P) {
      return (P & 61440) === 40960;
    }, isChrdev(P) {
      return (P & 61440) === 8192;
    }, isBlkdev(P) {
      return (P & 61440) === 24576;
    }, isFIFO(P) {
      return (P & 61440) === 4096;
    }, isSocket(P) {
      return (P & 49152) === 49152;
    }, flagsToPermissionString(P) {
      var gA = ["r", "w", "rw"][P & 3];
      return P & 512 && (gA += "w"), gA;
    }, nodePermissions(P, gA) {
      return iA.ignorePermissions ? 0 : gA.includes("r") && !(P.mode & 292) || gA.includes("w") && !(P.mode & 146) || gA.includes("x") && !(P.mode & 73) ? 2 : 0;
    }, mayLookup(P) {
      if (!iA.isDir(P.mode)) return 54;
      var gA = iA.nodePermissions(P, "x");
      return gA || (P.node_ops.lookup ? 0 : 2);
    }, mayCreate(P, gA) {
      if (!iA.isDir(P.mode))
        return 54;
      try {
        var wA = iA.lookupNode(P, gA);
        return 20;
      } catch {
      }
      return iA.nodePermissions(P, "wx");
    }, mayDelete(P, gA, wA) {
      var hA;
      try {
        hA = iA.lookupNode(P, gA);
      } catch (CI) {
        return CI.errno;
      }
      var pA = iA.nodePermissions(P, "wx");
      if (pA)
        return pA;
      if (wA) {
        if (!iA.isDir(hA.mode))
          return 54;
        if (iA.isRoot(hA) || iA.getPath(hA) === iA.cwd())
          return 10;
      } else if (iA.isDir(hA.mode))
        return 31;
      return 0;
    }, mayOpen(P, gA) {
      return P ? iA.isLink(P.mode) ? 32 : iA.isDir(P.mode) && (iA.flagsToPermissionString(gA) !== "r" || gA & 512) ? 31 : iA.nodePermissions(P, iA.flagsToPermissionString(gA)) : 44;
    }, MAX_OPEN_FDS: 4096, nextfd() {
      for (var P = 0; P <= iA.MAX_OPEN_FDS; P++)
        if (!iA.streams[P])
          return P;
      throw new iA.ErrnoError(33);
    }, getStreamChecked(P) {
      var gA = iA.getStream(P);
      if (!gA)
        throw new iA.ErrnoError(8);
      return gA;
    }, getStream: (P) => iA.streams[P], createStream(P, gA = -1) {
      return P = Object.assign(new iA.FSStream(), P), gA == -1 && (gA = iA.nextfd()), P.fd = gA, iA.streams[gA] = P, P;
    }, closeStream(P) {
      iA.streams[P] = null;
    }, dupStream(P, gA = -1) {
      var wA = iA.createStream(P, gA);
      return wA.stream_ops?.dup?.(wA), wA;
    }, chrdev_stream_ops: { open(P) {
      var gA = iA.getDevice(P.node.rdev);
      P.stream_ops = gA.stream_ops, P.stream_ops.open?.(P);
    }, llseek() {
      throw new iA.ErrnoError(70);
    } }, major: (P) => P >> 8, minor: (P) => P & 255, makedev: (P, gA) => P << 8 | gA, registerDevice(P, gA) {
      iA.devices[P] = { stream_ops: gA };
    }, getDevice: (P) => iA.devices[P], getMounts(P) {
      for (var gA = [], wA = [P]; wA.length; ) {
        var hA = wA.pop();
        gA.push(hA), wA.push(...hA.mounts);
      }
      return gA;
    }, syncfs(P, gA) {
      typeof P == "function" && (gA = P, P = !1), iA.syncFSRequests++, iA.syncFSRequests > 1 && X(`warning: ${iA.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`);
      var wA = iA.getMounts(iA.root.mount), hA = 0;
      function pA(fA) {
        return iA.syncFSRequests--, gA(fA);
      }
      function CI(fA) {
        if (fA)
          return CI.errored ? void 0 : (CI.errored = !0, pA(fA));
        ++hA >= wA.length && pA(null);
      }
      wA.forEach((fA) => {
        if (!fA.type.syncfs)
          return CI(null);
        fA.type.syncfs(fA, P, CI);
      });
    }, mount(P, gA, wA) {
      var hA = wA === "/", pA = !wA, CI;
      if (hA && iA.root)
        throw new iA.ErrnoError(10);
      if (!hA && !pA) {
        var fA = iA.lookupPath(wA, { follow_mount: !1 });
        if (wA = fA.path, CI = fA.node, iA.isMountpoint(CI))
          throw new iA.ErrnoError(10);
        if (!iA.isDir(CI.mode))
          throw new iA.ErrnoError(54);
      }
      var NI = { type: P, opts: gA, mountpoint: wA, mounts: [] }, tI = P.mount(NI);
      return tI.mount = NI, NI.root = tI, hA ? iA.root = tI : CI && (CI.mounted = NI, CI.mount && CI.mount.mounts.push(NI)), tI;
    }, unmount(P) {
      var gA = iA.lookupPath(P, { follow_mount: !1 });
      if (!iA.isMountpoint(gA.node))
        throw new iA.ErrnoError(28);
      var wA = gA.node, hA = wA.mounted, pA = iA.getMounts(hA);
      Object.keys(iA.nameTable).forEach((fA) => {
        for (var NI = iA.nameTable[fA]; NI; ) {
          var tI = NI.name_next;
          pA.includes(NI.mount) && iA.destroyNode(NI), NI = tI;
        }
      }), wA.mounted = null;
      var CI = wA.mount.mounts.indexOf(hA);
      wA.mount.mounts.splice(CI, 1);
    }, lookup(P, gA) {
      return P.node_ops.lookup(P, gA);
    }, mknod(P, gA, wA) {
      var hA = iA.lookupPath(P, { parent: !0 }), pA = hA.node, CI = ZC.basename(P);
      if (!CI || CI === "." || CI === "..")
        throw new iA.ErrnoError(28);
      var fA = iA.mayCreate(pA, CI);
      if (fA)
        throw new iA.ErrnoError(fA);
      if (!pA.node_ops.mknod)
        throw new iA.ErrnoError(63);
      return pA.node_ops.mknod(pA, CI, gA, wA);
    }, statfs(P) {
      var gA = { bsize: 4096, frsize: 4096, blocks: 1e6, bfree: 5e5, bavail: 5e5, files: iA.nextInode, ffree: iA.nextInode - 1, fsid: 42, flags: 2, namelen: 255 }, wA = iA.lookupPath(P, { follow: !0 }).node;
      return wA?.node_ops.statfs && Object.assign(gA, wA.node_ops.statfs(wA.mount.opts.root)), gA;
    }, create(P, gA = 438) {
      return gA &= 4095, gA |= 32768, iA.mknod(P, gA, 0);
    }, mkdir(P, gA = 511) {
      return gA &= 1023, gA |= 16384, iA.mknod(P, gA, 0);
    }, mkdirTree(P, gA) {
      for (var wA = P.split("/"), hA = "", pA = 0; pA < wA.length; ++pA)
        if (wA[pA]) {
          hA += "/" + wA[pA];
          try {
            iA.mkdir(hA, gA);
          } catch (CI) {
            if (CI.errno != 20) throw CI;
          }
        }
    }, mkdev(P, gA, wA) {
      return typeof wA > "u" && (wA = gA, gA = 438), gA |= 8192, iA.mknod(P, gA, wA);
    }, symlink(P, gA) {
      if (!aQ.resolve(P))
        throw new iA.ErrnoError(44);
      var wA = iA.lookupPath(gA, { parent: !0 }), hA = wA.node;
      if (!hA)
        throw new iA.ErrnoError(44);
      var pA = ZC.basename(gA), CI = iA.mayCreate(hA, pA);
      if (CI)
        throw new iA.ErrnoError(CI);
      if (!hA.node_ops.symlink)
        throw new iA.ErrnoError(63);
      return hA.node_ops.symlink(hA, pA, P);
    }, rename(P, gA) {
      var wA = ZC.dirname(P), hA = ZC.dirname(gA), pA = ZC.basename(P), CI = ZC.basename(gA), fA, NI, tI;
      if (fA = iA.lookupPath(P, { parent: !0 }), NI = fA.node, fA = iA.lookupPath(gA, { parent: !0 }), tI = fA.node, !NI || !tI) throw new iA.ErrnoError(44);
      if (NI.mount !== tI.mount)
        throw new iA.ErrnoError(75);
      var MC = iA.lookupNode(NI, pA), aC = aQ.relative(P, hA);
      if (aC.charAt(0) !== ".")
        throw new iA.ErrnoError(28);
      if (aC = aQ.relative(gA, wA), aC.charAt(0) !== ".")
        throw new iA.ErrnoError(55);
      var OI;
      try {
        OI = iA.lookupNode(tI, CI);
      } catch {
      }
      if (MC !== OI) {
        var NC = iA.isDir(MC.mode), hC = iA.mayDelete(NI, pA, NC);
        if (hC)
          throw new iA.ErrnoError(hC);
        if (hC = OI ? iA.mayDelete(tI, CI, NC) : iA.mayCreate(tI, CI), hC)
          throw new iA.ErrnoError(hC);
        if (!NI.node_ops.rename)
          throw new iA.ErrnoError(63);
        if (iA.isMountpoint(MC) || OI && iA.isMountpoint(OI))
          throw new iA.ErrnoError(10);
        if (tI !== NI && (hC = iA.nodePermissions(NI, "w"), hC))
          throw new iA.ErrnoError(hC);
        iA.hashRemoveNode(MC);
        try {
          NI.node_ops.rename(MC, tI, CI), MC.parent = tI;
        } catch (dI) {
          throw dI;
        } finally {
          iA.hashAddNode(MC);
        }
      }
    }, rmdir(P) {
      var gA = iA.lookupPath(P, { parent: !0 }), wA = gA.node, hA = ZC.basename(P), pA = iA.lookupNode(wA, hA), CI = iA.mayDelete(wA, hA, !0);
      if (CI)
        throw new iA.ErrnoError(CI);
      if (!wA.node_ops.rmdir)
        throw new iA.ErrnoError(63);
      if (iA.isMountpoint(pA))
        throw new iA.ErrnoError(10);
      wA.node_ops.rmdir(wA, hA), iA.destroyNode(pA);
    }, readdir(P) {
      var gA = iA.lookupPath(P, { follow: !0 }), wA = gA.node;
      if (!wA.node_ops.readdir)
        throw new iA.ErrnoError(54);
      return wA.node_ops.readdir(wA);
    }, unlink(P) {
      var gA = iA.lookupPath(P, { parent: !0 }), wA = gA.node;
      if (!wA)
        throw new iA.ErrnoError(44);
      var hA = ZC.basename(P), pA = iA.lookupNode(wA, hA), CI = iA.mayDelete(wA, hA, !1);
      if (CI)
        throw new iA.ErrnoError(CI);
      if (!wA.node_ops.unlink)
        throw new iA.ErrnoError(63);
      if (iA.isMountpoint(pA))
        throw new iA.ErrnoError(10);
      wA.node_ops.unlink(wA, hA), iA.destroyNode(pA);
    }, readlink(P) {
      var gA = iA.lookupPath(P), wA = gA.node;
      if (!wA)
        throw new iA.ErrnoError(44);
      if (!wA.node_ops.readlink)
        throw new iA.ErrnoError(28);
      return wA.node_ops.readlink(wA);
    }, stat(P, gA) {
      var wA = iA.lookupPath(P, { follow: !gA }), hA = wA.node;
      if (!hA)
        throw new iA.ErrnoError(44);
      if (!hA.node_ops.getattr)
        throw new iA.ErrnoError(63);
      return hA.node_ops.getattr(hA);
    }, lstat(P) {
      return iA.stat(P, !0);
    }, chmod(P, gA, wA) {
      var hA;
      if (typeof P == "string") {
        var pA = iA.lookupPath(P, { follow: !wA });
        hA = pA.node;
      } else
        hA = P;
      if (!hA.node_ops.setattr)
        throw new iA.ErrnoError(63);
      hA.node_ops.setattr(hA, { mode: gA & 4095 | hA.mode & -4096, ctime: Date.now() });
    }, lchmod(P, gA) {
      iA.chmod(P, gA, !0);
    }, fchmod(P, gA) {
      var wA = iA.getStreamChecked(P);
      iA.chmod(wA.node, gA);
    }, chown(P, gA, wA, hA) {
      var pA;
      if (typeof P == "string") {
        var CI = iA.lookupPath(P, { follow: !hA });
        pA = CI.node;
      } else
        pA = P;
      if (!pA.node_ops.setattr)
        throw new iA.ErrnoError(63);
      pA.node_ops.setattr(pA, { timestamp: Date.now() });
    }, lchown(P, gA, wA) {
      iA.chown(P, gA, wA, !0);
    }, fchown(P, gA, wA) {
      var hA = iA.getStreamChecked(P);
      iA.chown(hA.node, gA, wA);
    }, truncate(P, gA) {
      if (gA < 0)
        throw new iA.ErrnoError(28);
      var wA;
      if (typeof P == "string") {
        var hA = iA.lookupPath(P, { follow: !0 });
        wA = hA.node;
      } else
        wA = P;
      if (!wA.node_ops.setattr)
        throw new iA.ErrnoError(63);
      if (iA.isDir(wA.mode))
        throw new iA.ErrnoError(31);
      if (!iA.isFile(wA.mode))
        throw new iA.ErrnoError(28);
      var pA = iA.nodePermissions(wA, "w");
      if (pA)
        throw new iA.ErrnoError(pA);
      wA.node_ops.setattr(wA, { size: gA, timestamp: Date.now() });
    }, ftruncate(P, gA) {
      var wA = iA.getStreamChecked(P);
      if ((wA.flags & 2097155) === 0)
        throw new iA.ErrnoError(28);
      iA.truncate(wA.node, gA);
    }, utime(P, gA, wA) {
      var hA = iA.lookupPath(P, { follow: !0 }), pA = hA.node;
      pA.node_ops.setattr(pA, { atime: gA, mtime: wA });
    }, open(P, gA, wA = 438) {
      if (P === "")
        throw new iA.ErrnoError(44);
      gA = typeof gA == "string" ? lQ(gA) : gA, gA & 64 ? wA = wA & 4095 | 32768 : wA = 0;
      var hA;
      if (typeof P == "object")
        hA = P;
      else {
        var pA = iA.lookupPath(P, { follow: !(gA & 131072), noent_okay: !0 });
        hA = pA.node, P = pA.path;
      }
      var CI = !1;
      if (gA & 64)
        if (hA) {
          if (gA & 128)
            throw new iA.ErrnoError(20);
        } else
          hA = iA.mknod(P, wA, 0), CI = !0;
      if (!hA)
        throw new iA.ErrnoError(44);
      if (iA.isChrdev(hA.mode) && (gA &= -513), gA & 65536 && !iA.isDir(hA.mode))
        throw new iA.ErrnoError(54);
      if (!CI) {
        var fA = iA.mayOpen(hA, gA);
        if (fA)
          throw new iA.ErrnoError(fA);
      }
      gA & 512 && !CI && iA.truncate(hA, 0), gA &= -131713;
      var NI = iA.createStream({ node: hA, path: iA.getPath(hA), flags: gA, seekable: !0, position: 0, stream_ops: hA.stream_ops, ungotten: [], error: !1 });
      return NI.stream_ops.open && NI.stream_ops.open(NI), g.logReadFiles && !(gA & 1) && (P in iA.readFiles || (iA.readFiles[P] = 1)), NI;
    }, close(P) {
      if (iA.isClosed(P))
        throw new iA.ErrnoError(8);
      P.getdents && (P.getdents = null);
      try {
        P.stream_ops.close && P.stream_ops.close(P);
      } catch (gA) {
        throw gA;
      } finally {
        iA.closeStream(P.fd);
      }
      P.fd = null;
    }, isClosed(P) {
      return P.fd === null;
    }, llseek(P, gA, wA) {
      if (iA.isClosed(P))
        throw new iA.ErrnoError(8);
      if (!P.seekable || !P.stream_ops.llseek)
        throw new iA.ErrnoError(70);
      if (wA != 0 && wA != 1 && wA != 2)
        throw new iA.ErrnoError(28);
      return P.position = P.stream_ops.llseek(P, gA, wA), P.ungotten = [], P.position;
    }, read(P, gA, wA, hA, pA) {
      if (hA < 0 || pA < 0)
        throw new iA.ErrnoError(28);
      if (iA.isClosed(P))
        throw new iA.ErrnoError(8);
      if ((P.flags & 2097155) === 1)
        throw new iA.ErrnoError(8);
      if (iA.isDir(P.node.mode))
        throw new iA.ErrnoError(31);
      if (!P.stream_ops.read)
        throw new iA.ErrnoError(28);
      var CI = typeof pA < "u";
      if (!CI)
        pA = P.position;
      else if (!P.seekable)
        throw new iA.ErrnoError(70);
      var fA = P.stream_ops.read(P, gA, wA, hA, pA);
      return CI || (P.position += fA), fA;
    }, write(P, gA, wA, hA, pA, CI) {
      if (hA < 0 || pA < 0)
        throw new iA.ErrnoError(28);
      if (iA.isClosed(P))
        throw new iA.ErrnoError(8);
      if ((P.flags & 2097155) === 0)
        throw new iA.ErrnoError(8);
      if (iA.isDir(P.node.mode))
        throw new iA.ErrnoError(31);
      if (!P.stream_ops.write)
        throw new iA.ErrnoError(28);
      P.seekable && P.flags & 1024 && iA.llseek(P, 0, 2);
      var fA = typeof pA < "u";
      if (!fA)
        pA = P.position;
      else if (!P.seekable)
        throw new iA.ErrnoError(70);
      var NI = P.stream_ops.write(P, gA, wA, hA, pA, CI);
      return fA || (P.position += NI), NI;
    }, allocate(P, gA, wA) {
      if (iA.isClosed(P))
        throw new iA.ErrnoError(8);
      if (gA < 0 || wA <= 0)
        throw new iA.ErrnoError(28);
      if ((P.flags & 2097155) === 0)
        throw new iA.ErrnoError(8);
      if (!iA.isFile(P.node.mode) && !iA.isDir(P.node.mode))
        throw new iA.ErrnoError(43);
      if (!P.stream_ops.allocate)
        throw new iA.ErrnoError(138);
      P.stream_ops.allocate(P, gA, wA);
    }, mmap(P, gA, wA, hA, pA) {
      if ((hA & 2) !== 0 && (pA & 2) === 0 && (P.flags & 2097155) !== 2)
        throw new iA.ErrnoError(2);
      if ((P.flags & 2097155) === 1)
        throw new iA.ErrnoError(2);
      if (!P.stream_ops.mmap)
        throw new iA.ErrnoError(43);
      if (!gA)
        throw new iA.ErrnoError(28);
      return P.stream_ops.mmap(P, gA, wA, hA, pA);
    }, msync(P, gA, wA, hA, pA) {
      return P.stream_ops.msync ? P.stream_ops.msync(P, gA, wA, hA, pA) : 0;
    }, ioctl(P, gA, wA) {
      if (!P.stream_ops.ioctl)
        throw new iA.ErrnoError(59);
      return P.stream_ops.ioctl(P, gA, wA);
    }, readFile(P, gA = {}) {
      if (gA.flags = gA.flags || 0, gA.encoding = gA.encoding || "binary", gA.encoding !== "utf8" && gA.encoding !== "binary")
        throw new Error(`Invalid encoding type "${gA.encoding}"`);
      var wA, hA = iA.open(P, gA.flags), pA = iA.stat(P), CI = pA.size, fA = new Uint8Array(CI);
      return iA.read(hA, fA, 0, CI, 0), gA.encoding === "utf8" ? wA = lI(fA) : gA.encoding === "binary" && (wA = fA), iA.close(hA), wA;
    }, writeFile(P, gA, wA = {}) {
      wA.flags = wA.flags || 577;
      var hA = iA.open(P, wA.flags, wA.mode);
      if (typeof gA == "string") {
        var pA = new Uint8Array(UQ(gA) + 1), CI = qQ(gA, pA, 0, pA.length);
        iA.write(hA, pA, 0, CI, void 0, wA.canOwn);
      } else if (ArrayBuffer.isView(gA))
        iA.write(hA, gA, 0, gA.byteLength, void 0, wA.canOwn);
      else
        throw new Error("Unsupported data type");
      iA.close(hA);
    }, cwd: () => iA.currentPath, chdir(P) {
      var gA = iA.lookupPath(P, { follow: !0 });
      if (gA.node === null)
        throw new iA.ErrnoError(44);
      if (!iA.isDir(gA.node.mode))
        throw new iA.ErrnoError(54);
      var wA = iA.nodePermissions(gA.node, "x");
      if (wA)
        throw new iA.ErrnoError(wA);
      iA.currentPath = gA.path;
    }, createDefaultDirectories() {
      iA.mkdir("/tmp"), iA.mkdir("/home"), iA.mkdir("/home/web_user");
    }, createDefaultDevices() {
      iA.mkdir("/dev"), iA.registerDevice(iA.makedev(1, 3), { read: () => 0, write: (hA, pA, CI, fA, NI) => fA, llseek: () => 0 }), iA.mkdev("/dev/null", iA.makedev(1, 3)), NQ.register(iA.makedev(5, 0), NQ.default_tty_ops), NQ.register(iA.makedev(6, 0), NQ.default_tty1_ops), iA.mkdev("/dev/tty", iA.makedev(5, 0)), iA.mkdev("/dev/tty1", iA.makedev(6, 0));
      var P = new Uint8Array(1024), gA = 0, wA = () => (gA === 0 && (gA = QQ(P).byteLength), P[--gA]);
      iA.createDevice("/dev", "random", wA), iA.createDevice("/dev", "urandom", wA), iA.mkdir("/dev/shm"), iA.mkdir("/dev/shm/tmp");
    }, createSpecialDirectories() {
      iA.mkdir("/proc");
      var P = iA.mkdir("/proc/self");
      iA.mkdir("/proc/self/fd"), iA.mount({ mount() {
        var gA = iA.createNode(P, "fd", 16895, 73);
        return gA.stream_ops = { llseek: bC.stream_ops.llseek }, gA.node_ops = { lookup(wA, hA) {
          var pA = +hA, CI = iA.getStreamChecked(pA), fA = { parent: null, mount: { mountpoint: "fake" }, node_ops: { readlink: () => CI.path }, id: pA + 1 };
          return fA.parent = fA, fA;
        }, readdir() {
          return Array.from(iA.streams.entries()).filter(([wA, hA]) => hA).map(([wA, hA]) => wA.toString());
        } }, gA;
      } }, {}, "/proc/self/fd");
    }, createStandardStreams(P, gA, wA) {
      P ? iA.createDevice("/dev", "stdin", P) : iA.symlink("/dev/tty", "/dev/stdin"), gA ? iA.createDevice("/dev", "stdout", null, gA) : iA.symlink("/dev/tty", "/dev/stdout"), wA ? iA.createDevice("/dev", "stderr", null, wA) : iA.symlink("/dev/tty1", "/dev/stderr"), iA.open("/dev/stdin", 0), iA.open("/dev/stdout", 1), iA.open("/dev/stderr", 1);
    }, staticInit() {
      iA.nameTable = new Array(4096), iA.mount(bC, {}, "/"), iA.createDefaultDirectories(), iA.createDefaultDevices(), iA.createSpecialDirectories(), iA.filesystems = { MEMFS: bC };
    }, init(P, gA, wA) {
      iA.initialized = !0, P ??= g.stdin, gA ??= g.stdout, wA ??= g.stderr, iA.createStandardStreams(P, gA, wA);
    }, quit() {
      iA.initialized = !1;
      for (var P = 0; P < iA.streams.length; P++) {
        var gA = iA.streams[P];
        gA && iA.close(gA);
      }
    }, findObject(P, gA) {
      var wA = iA.analyzePath(P, gA);
      return wA.exists ? wA.object : null;
    }, analyzePath(P, gA) {
      try {
        var wA = iA.lookupPath(P, { follow: !gA });
        P = wA.path;
      } catch {
      }
      var hA = { isRoot: !1, exists: !1, error: 0, name: null, path: null, object: null, parentExists: !1, parentPath: null, parentObject: null };
      try {
        var wA = iA.lookupPath(P, { parent: !0 });
        hA.parentExists = !0, hA.parentPath = wA.path, hA.parentObject = wA.node, hA.name = ZC.basename(P), wA = iA.lookupPath(P, { follow: !gA }), hA.exists = !0, hA.path = wA.path, hA.object = wA.node, hA.name = wA.node.name, hA.isRoot = wA.path === "/";
      } catch (pA) {
        hA.error = pA.errno;
      }
      return hA;
    }, createPath(P, gA, wA, hA) {
      P = typeof P == "string" ? P : iA.getPath(P);
      for (var pA = gA.split("/").reverse(); pA.length; ) {
        var CI = pA.pop();
        if (CI) {
          var fA = ZC.join2(P, CI);
          try {
            iA.mkdir(fA);
          } catch {
          }
          P = fA;
        }
      }
      return fA;
    }, createFile(P, gA, wA, hA, pA) {
      var CI = ZC.join2(typeof P == "string" ? P : iA.getPath(P), gA), fA = TI(hA, pA);
      return iA.create(CI, fA);
    }, createDataFile(P, gA, wA, hA, pA, CI) {
      var fA = gA;
      P && (P = typeof P == "string" ? P : iA.getPath(P), fA = gA ? ZC.join2(P, gA) : P);
      var NI = TI(hA, pA), tI = iA.create(fA, NI);
      if (wA) {
        if (typeof wA == "string") {
          for (var MC = new Array(wA.length), aC = 0, OI = wA.length; aC < OI; ++aC) MC[aC] = wA.charCodeAt(aC);
          wA = MC;
        }
        iA.chmod(tI, NI | 146);
        var NC = iA.open(tI, 577);
        iA.write(NC, wA, 0, wA.length, 0, CI), iA.close(NC), iA.chmod(tI, NI);
      }
    }, createDevice(P, gA, wA, hA) {
      var pA = ZC.join2(typeof P == "string" ? P : iA.getPath(P), gA), CI = TI(!!wA, !!hA);
      iA.createDevice.major ??= 64;
      var fA = iA.makedev(iA.createDevice.major++, 0);
      return iA.registerDevice(fA, { open(NI) {
        NI.seekable = !1;
      }, close(NI) {
        hA?.buffer?.length && hA(10);
      }, read(NI, tI, MC, aC, OI) {
        for (var NC = 0, hC = 0; hC < aC; hC++) {
          var dI;
          try {
            dI = wA();
          } catch {
            throw new iA.ErrnoError(29);
          }
          if (dI === void 0 && NC === 0)
            throw new iA.ErrnoError(6);
          if (dI == null) break;
          NC++, tI[MC + hC] = dI;
        }
        return NC && (NI.node.atime = Date.now()), NC;
      }, write(NI, tI, MC, aC, OI) {
        for (var NC = 0; NC < aC; NC++)
          try {
            hA(tI[MC + NC]);
          } catch {
            throw new iA.ErrnoError(29);
          }
        return aC && (NI.node.mtime = NI.node.ctime = Date.now()), NC;
      } }), iA.mkdev(pA, CI, fA);
    }, forceLoadFile(P) {
      if (P.isDevice || P.isFolder || P.link || P.contents) return !0;
      if (typeof XMLHttpRequest < "u")
        throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
      try {
        P.contents = p(P.url), P.usedBytes = P.contents.length;
      } catch {
        throw new iA.ErrnoError(29);
      }
    }, createLazyFile(P, gA, wA, hA, pA) {
      class CI {
        lengthKnown = !1;
        chunks = [];
        get(hC) {
          if (!(hC > this.length - 1 || hC < 0)) {
            var dI = hC % this.chunkSize, eC = hC / this.chunkSize | 0;
            return this.getter(eC)[dI];
          }
        }
        setDataGetter(hC) {
          this.getter = hC;
        }
        cacheLength() {
          var hC = new XMLHttpRequest();
          if (hC.open("HEAD", wA, !1), hC.send(null), !(hC.status >= 200 && hC.status < 300 || hC.status === 304)) throw new Error("Couldn't load " + wA + ". Status: " + hC.status);
          var dI = Number(hC.getResponseHeader("Content-length")), eC, vI = (eC = hC.getResponseHeader("Accept-Ranges")) && eC === "bytes", sC = (eC = hC.getResponseHeader("Content-Encoding")) && eC === "gzip", nC = 1024 * 1024;
          vI || (nC = dI);
          var OC = (CC, GA) => {
            if (CC > GA) throw new Error("invalid range (" + CC + ", " + GA + ") or no bytes requested!");
            if (GA > dI - 1) throw new Error("only " + dI + " bytes available! programmer error!");
            var JA = new XMLHttpRequest();
            if (JA.open("GET", wA, !1), dI !== nC && JA.setRequestHeader("Range", "bytes=" + CC + "-" + GA), JA.responseType = "arraybuffer", JA.overrideMimeType && JA.overrideMimeType("text/plain; charset=x-user-defined"), JA.send(null), !(JA.status >= 200 && JA.status < 300 || JA.status === 304)) throw new Error("Couldn't load " + wA + ". Status: " + JA.status);
            return JA.response !== void 0 ? new Uint8Array(JA.response || []) : jC(JA.responseText || "");
          }, zC = this;
          zC.setDataGetter((CC) => {
            var GA = CC * nC, JA = (CC + 1) * nC - 1;
            if (JA = Math.min(JA, dI - 1), typeof zC.chunks[CC] > "u" && (zC.chunks[CC] = OC(GA, JA)), typeof zC.chunks[CC] > "u") throw new Error("doXHR failed!");
            return zC.chunks[CC];
          }), (sC || !dI) && (nC = dI = 1, dI = this.getter(0).length, nC = dI, $("LazyFiles on gzip forces download of the whole file when length is accessed")), this._length = dI, this._chunkSize = nC, this.lengthKnown = !0;
        }
        get length() {
          return this.lengthKnown || this.cacheLength(), this._length;
        }
        get chunkSize() {
          return this.lengthKnown || this.cacheLength(), this._chunkSize;
        }
      }
      if (typeof XMLHttpRequest < "u") {
        if (!S) throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
        var fA = new CI(), NI = { isDevice: !1, contents: fA };
      } else
        var NI = { isDevice: !1, url: wA };
      var tI = iA.createFile(P, gA, NI, hA, pA);
      NI.contents ? tI.contents = NI.contents : NI.url && (tI.contents = null, tI.url = NI.url), Object.defineProperties(tI, { usedBytes: { get: function() {
        return this.contents.length;
      } } });
      var MC = {}, aC = Object.keys(tI.stream_ops);
      aC.forEach((NC) => {
        var hC = tI.stream_ops[NC];
        MC[NC] = (...dI) => (iA.forceLoadFile(tI), hC(...dI));
      });
      function OI(NC, hC, dI, eC, vI) {
        var sC = NC.node.contents;
        if (vI >= sC.length) return 0;
        var nC = Math.min(sC.length - vI, eC);
        if (sC.slice)
          for (var OC = 0; OC < nC; OC++)
            hC[dI + OC] = sC[vI + OC];
        else
          for (var OC = 0; OC < nC; OC++)
            hC[dI + OC] = sC.get(vI + OC);
        return nC;
      }
      return MC.read = (NC, hC, dI, eC, vI) => (iA.forceLoadFile(tI), OI(NC, hC, dI, eC, vI)), MC.mmap = (NC, hC, dI, eC, vI) => {
        iA.forceLoadFile(tI);
        var sC = vQ();
        if (!sC)
          throw new iA.ErrnoError(48);
        return OI(NC, lA, sC, hC, dI), { ptr: sC, allocated: !0 };
      }, tI.stream_ops = MC, tI;
    } }, iC = { DEFAULT_POLLMASK: 5, calculateAt(P, gA, wA) {
      if (ZC.isAbs(gA))
        return gA;
      var hA;
      if (P === -100)
        hA = iA.cwd();
      else {
        var pA = iC.getStreamFromFD(P);
        hA = pA.path;
      }
      if (gA.length == 0) {
        if (!wA)
          throw new iA.ErrnoError(44);
        return hA;
      }
      return hA + "/" + gA;
    }, doStat(P, gA, wA) {
      var hA = P(gA);
      rA[wA >> 2] = hA.dev, rA[wA + 4 >> 2] = hA.mode, jA[wA + 8 >> 2] = hA.nlink, rA[wA + 12 >> 2] = hA.uid, rA[wA + 16 >> 2] = hA.gid, rA[wA + 20 >> 2] = hA.rdev, aA = [hA.size >>> 0, (eA = hA.size, +Math.abs(eA) >= 1 ? eA > 0 ? +Math.floor(eA / 4294967296) >>> 0 : ~~+Math.ceil((eA - +(~~eA >>> 0)) / 4294967296) >>> 0 : 0)], rA[wA + 24 >> 2] = aA[0], rA[wA + 28 >> 2] = aA[1], rA[wA + 32 >> 2] = 4096, rA[wA + 36 >> 2] = hA.blocks;
      var pA = hA.atime.getTime(), CI = hA.mtime.getTime(), fA = hA.ctime.getTime();
      return aA = [Math.floor(pA / 1e3) >>> 0, (eA = Math.floor(pA / 1e3), +Math.abs(eA) >= 1 ? eA > 0 ? +Math.floor(eA / 4294967296) >>> 0 : ~~+Math.ceil((eA - +(~~eA >>> 0)) / 4294967296) >>> 0 : 0)], rA[wA + 40 >> 2] = aA[0], rA[wA + 44 >> 2] = aA[1], jA[wA + 48 >> 2] = pA % 1e3 * 1e3 * 1e3, aA = [Math.floor(CI / 1e3) >>> 0, (eA = Math.floor(CI / 1e3), +Math.abs(eA) >= 1 ? eA > 0 ? +Math.floor(eA / 4294967296) >>> 0 : ~~+Math.ceil((eA - +(~~eA >>> 0)) / 4294967296) >>> 0 : 0)], rA[wA + 56 >> 2] = aA[0], rA[wA + 60 >> 2] = aA[1], jA[wA + 64 >> 2] = CI % 1e3 * 1e3 * 1e3, aA = [Math.floor(fA / 1e3) >>> 0, (eA = Math.floor(fA / 1e3), +Math.abs(eA) >= 1 ? eA > 0 ? +Math.floor(eA / 4294967296) >>> 0 : ~~+Math.ceil((eA - +(~~eA >>> 0)) / 4294967296) >>> 0 : 0)], rA[wA + 72 >> 2] = aA[0], rA[wA + 76 >> 2] = aA[1], jA[wA + 80 >> 2] = fA % 1e3 * 1e3 * 1e3, aA = [hA.ino >>> 0, (eA = hA.ino, +Math.abs(eA) >= 1 ? eA > 0 ? +Math.floor(eA / 4294967296) >>> 0 : ~~+Math.ceil((eA - +(~~eA >>> 0)) / 4294967296) >>> 0 : 0)], rA[wA + 88 >> 2] = aA[0], rA[wA + 92 >> 2] = aA[1], 0;
    }, doMsync(P, gA, wA, hA, pA) {
      if (!iA.isFile(gA.node.mode))
        throw new iA.ErrnoError(43);
      if (hA & 2)
        return 0;
      var CI = HA.slice(P, P + wA);
      iA.msync(gA, CI, pA, wA, hA);
    }, getStreamFromFD(P) {
      var gA = iA.getStreamChecked(P);
      return gA;
    }, varargs: void 0, getStr(P) {
      var gA = bI(P);
      return gA;
    } };
    function iQ(P, gA, wA) {
      iC.varargs = wA;
      try {
        var hA = iC.getStreamFromFD(P);
        switch (gA) {
          case 0: {
            var pA = Vg();
            if (pA < 0)
              return -28;
            for (; iA.streams[pA]; )
              pA++;
            var CI;
            return CI = iA.dupStream(hA, pA), CI.fd;
          }
          case 1:
          case 2:
            return 0;
          case 3:
            return hA.flags;
          case 4: {
            var pA = Vg();
            return hA.flags |= pA, 0;
          }
          case 12: {
            var pA = TC(), fA = 0;
            return OA[pA + fA >> 1] = 2, 0;
          }
          case 13:
          case 14:
            return 0;
        }
        return -28;
      } catch (NI) {
        if (typeof iA > "u" || NI.name !== "ErrnoError") throw NI;
        return -NI.errno;
      }
    }
    var OQ = (P, gA, wA) => qQ(P, HA, gA, wA);
    function FB(P, gA, wA) {
      try {
        var hA = iC.getStreamFromFD(P);
        hA.getdents ||= iA.readdir(hA.path);
        for (var pA = 280, CI = 0, fA = iA.llseek(hA, 0, 1), NI = Math.floor(fA / pA), tI = Math.min(hA.getdents.length, NI + Math.floor(wA / pA)), MC = NI; MC < tI; MC++) {
          var aC, OI, NC = hA.getdents[MC];
          if (NC === ".")
            aC = hA.node.id, OI = 4;
          else if (NC === "..") {
            var hC = iA.lookupPath(hA.path, { parent: !0 });
            aC = hC.node.id, OI = 4;
          } else {
            var dI;
            try {
              dI = iA.lookupNode(hA.node, NC);
            } catch (eC) {
              if (eC?.errno === 28)
                continue;
              throw eC;
            }
            aC = dI.id, OI = iA.isChrdev(dI.mode) ? 2 : iA.isDir(dI.mode) ? 4 : iA.isLink(dI.mode) ? 10 : 8;
          }
          aA = [aC >>> 0, (eA = aC, +Math.abs(eA) >= 1 ? eA > 0 ? +Math.floor(eA / 4294967296) >>> 0 : ~~+Math.ceil((eA - +(~~eA >>> 0)) / 4294967296) >>> 0 : 0)], rA[gA + CI >> 2] = aA[0], rA[gA + CI + 4 >> 2] = aA[1], aA = [(MC + 1) * pA >>> 0, (eA = (MC + 1) * pA, +Math.abs(eA) >= 1 ? eA > 0 ? +Math.floor(eA / 4294967296) >>> 0 : ~~+Math.ceil((eA - +(~~eA >>> 0)) / 4294967296) >>> 0 : 0)], rA[gA + CI + 8 >> 2] = aA[0], rA[gA + CI + 12 >> 2] = aA[1], OA[gA + CI + 16 >> 1] = 280, lA[gA + CI + 18] = OI, OQ(NC, gA + CI + 19, 256), CI += pA;
        }
        return iA.llseek(hA, MC * pA, 0), CI;
      } catch (eC) {
        if (typeof iA > "u" || eC.name !== "ErrnoError") throw eC;
        return -eC.errno;
      }
    }
    function Wg(P, gA, wA) {
      iC.varargs = wA;
      try {
        var hA = iC.getStreamFromFD(P);
        switch (gA) {
          case 21509:
            return hA.tty ? 0 : -59;
          case 21505: {
            if (!hA.tty) return -59;
            if (hA.tty.ops.ioctl_tcgets) {
              var pA = hA.tty.ops.ioctl_tcgets(hA), CI = TC();
              rA[CI >> 2] = pA.c_iflag || 0, rA[CI + 4 >> 2] = pA.c_oflag || 0, rA[CI + 8 >> 2] = pA.c_cflag || 0, rA[CI + 12 >> 2] = pA.c_lflag || 0;
              for (var fA = 0; fA < 32; fA++)
                lA[CI + fA + 17] = pA.c_cc[fA] || 0;
              return 0;
            }
            return 0;
          }
          case 21510:
          case 21511:
          case 21512:
            return hA.tty ? 0 : -59;
          case 21506:
          case 21507:
          case 21508: {
            if (!hA.tty) return -59;
            if (hA.tty.ops.ioctl_tcsets) {
              for (var CI = TC(), NI = rA[CI >> 2], tI = rA[CI + 4 >> 2], MC = rA[CI + 8 >> 2], aC = rA[CI + 12 >> 2], OI = [], fA = 0; fA < 32; fA++)
                OI.push(lA[CI + fA + 17]);
              return hA.tty.ops.ioctl_tcsets(hA.tty, gA, { c_iflag: NI, c_oflag: tI, c_cflag: MC, c_lflag: aC, c_cc: OI });
            }
            return 0;
          }
          case 21519: {
            if (!hA.tty) return -59;
            var CI = TC();
            return rA[CI >> 2] = 0, 0;
          }
          case 21520:
            return hA.tty ? -28 : -59;
          case 21531: {
            var CI = TC();
            return iA.ioctl(hA, gA, CI);
          }
          case 21523: {
            if (!hA.tty) return -59;
            if (hA.tty.ops.ioctl_tiocgwinsz) {
              var NC = hA.tty.ops.ioctl_tiocgwinsz(hA.tty), CI = TC();
              OA[CI >> 1] = NC[0], OA[CI + 2 >> 1] = NC[1];
            }
            return 0;
          }
          case 21524:
            return hA.tty ? 0 : -59;
          case 21515:
            return hA.tty ? 0 : -59;
          default:
            return -28;
        }
      } catch (hC) {
        if (typeof iA > "u" || hC.name !== "ErrnoError") throw hC;
        return -hC.errno;
      }
    }
    function zQ(P, gA, wA, hA) {
      iC.varargs = hA;
      try {
        gA = iC.getStr(gA), gA = iC.calculateAt(P, gA);
        var pA = hA ? Vg() : 0;
        return iA.open(gA, wA, pA).fd;
      } catch (CI) {
        if (typeof iA > "u" || CI.name !== "ErrnoError") throw CI;
        return -CI.errno;
      }
    }
    function MQ(P) {
      try {
        return P = iC.getStr(P), iA.rmdir(P), 0;
      } catch (gA) {
        if (typeof iA > "u" || gA.name !== "ErrnoError") throw gA;
        return -gA.errno;
      }
    }
    function MB(P, gA) {
      try {
        return P = iC.getStr(P), iC.doStat(iA.stat, P, gA);
      } catch (wA) {
        if (typeof iA > "u" || wA.name !== "ErrnoError") throw wA;
        return -wA.errno;
      }
    }
    function Jg(P, gA, wA) {
      try {
        return gA = iC.getStr(gA), gA = iC.calculateAt(P, gA), wA === 0 ? iA.unlink(gA) : wA === 512 ? iA.rmdir(gA) : qA("Invalid flags passed to unlinkat"), 0;
      } catch (hA) {
        if (typeof iA > "u" || hA.name !== "ErrnoError") throw hA;
        return -hA.errno;
      }
    }
    var DB = () => qA(""), XQ = (P, gA, wA) => HA.copyWithin(P, gA, gA + wA), HB = (P, gA, wA, hA) => {
      var pA = (/* @__PURE__ */ new Date()).getFullYear(), CI = new Date(pA, 0, 1), fA = new Date(pA, 6, 1), NI = CI.getTimezoneOffset(), tI = fA.getTimezoneOffset(), MC = Math.max(NI, tI);
      jA[P >> 2] = MC * 60, rA[gA >> 2] = +(NI != tI);
      var aC = (hC) => {
        var dI = hC >= 0 ? "-" : "+", eC = Math.abs(hC), vI = String(Math.floor(eC / 60)).padStart(2, "0"), sC = String(eC % 60).padStart(2, "0");
        return `UTC${dI}${vI}${sC}`;
      }, OI = aC(NI), NC = aC(tI);
      tI < NI ? (OQ(OI, wA, 17), OQ(NC, hA, 17)) : (OQ(OI, hA, 17), OQ(NC, wA, 17));
    }, GB = () => performance.now(), SB = () => Date.now(), mQ = (P) => P >= 0 && P <= 3, oB = (P, gA) => gA + 2097152 >>> 0 < 4194305 - !!P ? (P >>> 0) + gA * 4294967296 : NaN;
    function fQ(P, gA, wA, hA) {
      if (!mQ(P))
        return 28;
      var pA;
      P === 0 ? pA = SB() : pA = GB();
      var CI = Math.round(pA * 1e3 * 1e3);
      return aA = [CI >>> 0, (eA = CI, +Math.abs(eA) >= 1 ? eA > 0 ? +Math.floor(eA / 4294967296) >>> 0 : ~~+Math.ceil((eA - +(~~eA >>> 0)) / 4294967296) >>> 0 : 0)], rA[hA >> 2] = aA[0], rA[hA + 4 >> 2] = aA[1], 0;
    }
    var $Q = (P) => {
      qA("OOM");
    }, AB = (P) => {
      HA.length, $Q();
    }, FQ = {}, bQ = () => c || "./this.program", EB = () => {
      if (!EB.strings) {
        var P = (typeof navigator == "object" && navigator.languages && navigator.languages[0] || "C").replace("-", "_") + ".UTF-8", gA = { USER: "web_user", LOGNAME: "web_user", PATH: "/", PWD: "/", HOME: "/home/web_user", LANG: P, _: bQ() };
        for (var wA in FQ)
          FQ[wA] === void 0 ? delete gA[wA] : gA[wA] = FQ[wA];
        var hA = [];
        for (var wA in gA)
          hA.push(`${wA}=${gA[wA]}`);
        EB.strings = hA;
      }
      return EB.strings;
    }, HQ = (P, gA) => {
      for (var wA = 0; wA < P.length; ++wA)
        lA[gA++] = P.charCodeAt(wA);
      lA[gA] = 0;
    }, YB = (P, gA) => {
      var wA = 0;
      return EB().forEach((hA, pA) => {
        var CI = gA + wA;
        jA[P + pA * 4 >> 2] = CI, HQ(hA, CI), wA += hA.length + 1;
      }), 0;
    }, yB = (P, gA) => {
      var wA = EB();
      jA[P >> 2] = wA.length;
      var hA = 0;
      return wA.forEach((pA) => hA += pA.length + 1), jA[gA >> 2] = hA, 0;
    }, LQ = (P) => {
      RA = P, l(P, new II(P));
    }, cC = (P, gA) => {
      RA = P, LQ(P);
    }, YQ = cC;
    function KQ(P) {
      try {
        var gA = iC.getStreamFromFD(P);
        return iA.close(gA), 0;
      } catch (wA) {
        if (typeof iA > "u" || wA.name !== "ErrnoError") throw wA;
        return wA.errno;
      }
    }
    var LB = (P, gA, wA, hA) => {
      for (var pA = 0, CI = 0; CI < wA; CI++) {
        var fA = jA[gA >> 2], NI = jA[gA + 4 >> 2];
        gA += 8;
        var tI = iA.read(P, lA, fA, NI, hA);
        if (tI < 0) return -1;
        if (pA += tI, tI < NI) break;
      }
      return pA;
    };
    function jB(P, gA, wA, hA) {
      try {
        var pA = iC.getStreamFromFD(P), CI = LB(pA, gA, wA);
        return jA[hA >> 2] = CI, 0;
      } catch (fA) {
        if (typeof iA > "u" || fA.name !== "ErrnoError") throw fA;
        return fA.errno;
      }
    }
    function JB(P, gA, wA, hA, pA) {
      var CI = oB(gA, wA);
      try {
        if (isNaN(CI)) return 61;
        var fA = iC.getStreamFromFD(P);
        return iA.llseek(fA, CI, hA), aA = [fA.position >>> 0, (eA = fA.position, +Math.abs(eA) >= 1 ? eA > 0 ? +Math.floor(eA / 4294967296) >>> 0 : ~~+Math.ceil((eA - +(~~eA >>> 0)) / 4294967296) >>> 0 : 0)], rA[pA >> 2] = aA[0], rA[pA + 4 >> 2] = aA[1], fA.getdents && CI === 0 && hA === 0 && (fA.getdents = null), 0;
      } catch (NI) {
        if (typeof iA > "u" || NI.name !== "ErrnoError") throw NI;
        return NI.errno;
      }
    }
    var nB = (P, gA, wA, hA) => {
      for (var pA = 0, CI = 0; CI < wA; CI++) {
        var fA = jA[gA >> 2], NI = jA[gA + 4 >> 2];
        gA += 8;
        var tI = iA.write(P, lA, fA, NI, hA);
        if (tI < 0) return -1;
        if (pA += tI, tI < NI)
          break;
      }
      return pA;
    };
    function aB(P, gA, wA, hA) {
      try {
        var pA = iC.getStreamFromFD(P), CI = nB(pA, gA, wA);
        return jA[hA >> 2] = CI, 0;
      } catch (fA) {
        if (typeof iA > "u" || fA.name !== "ErrnoError") throw fA;
        return fA.errno;
      }
    }
    var ZB = (P) => {
      if (P instanceof II || P == "unwind")
        return RA;
      l(1, P);
    }, Kg = (P) => UC(P), wI = (P) => {
      var gA = UQ(P) + 1, wA = Kg(gA);
      return OQ(P, wA, gA), wA;
    }, UA = iA.createPath, PA = (P) => iA.unlink(P), uA = iA.createLazyFile, QI = iA.createDevice;
    iA.createPreloadedFile = IQ, iA.staticInit(), g.FS_createPath = iA.createPath, g.FS_createDataFile = iA.createDataFile, g.FS_createPreloadedFile = iA.createPreloadedFile, g.FS_unlink = iA.unlink, g.FS_createLazyFile = iA.createLazyFile, g.FS_createDevice = iA.createDevice, bC.doesNotExistError = new iA.ErrnoError(44), bC.doesNotExistError.stack = "<generic error, no stack>";
    var KI = { a: PI, b: mC, e: iQ, s: FB, h: Wg, f: zQ, q: MQ, p: MB, r: Jg, k: DB, j: XQ, n: HB, l: fQ, i: SB, o: AB, t: YB, u: yB, d: YQ, c: KQ, v: jB, m: JB, g: aB }, qI;
    NA();
    var EC = g._main = (P, gA) => (EC = g._main = qI.y)(P, gA), UC = (P) => (UC = qI.A)(P);
    g.addRunDependency = JI, g.removeRunDependency = oI, g.callMain = gC, g.FS_createPreloadedFile = IQ, g.FS_unlink = PA, g.FS_createPath = UA, g.FS_createDevice = QI, g.FS = iA, g.FS_createDataFile = _Q, g.FS_createLazyFile = uA;
    var DC;
    tA = function P() {
      DC || uC(), DC || (tA = P);
    };
    function gC(P = []) {
      var gA = EC;
      P.unshift(c);
      var wA = P.length, hA = Kg((wA + 1) * 4), pA = hA;
      P.forEach((fA) => {
        jA[pA >> 2] = wI(fA), pA += 4;
      }), jA[pA >> 2] = 0;
      try {
        var CI = gA(wA, hA);
        return cC(CI, !0), CI;
      } catch (fA) {
        return ZB(fA);
      }
    }
    function uC(P = y) {
      if (SI > 0 || (FI(), SI > 0))
        return;
      function gA() {
        DC || (DC = !0, g.calledRun = !0, !IA && (RI(), cA(), N(g), g.onRuntimeInitialized?.(), pC && gC(P), sA()));
      }
      g.setStatus ? (g.setStatus("Running..."), setTimeout(() => {
        setTimeout(() => g.setStatus(""), 1), gA();
      }, 1)) : gA();
    }
    if (g.preInit)
      for (typeof g.preInit == "function" && (g.preInit = [g.preInit]); g.preInit.length > 0; )
        g.preInit.pop()();
    var pC = !1;
    return g.noInitialRun && (pC = !1), uC(), C = o, C;
  };
})()
module.exports = createPiperPhonemize;
module.exports.default = createPiperPhonemize;
