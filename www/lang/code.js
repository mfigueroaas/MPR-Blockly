'use strict';

// MPR: la app es solo en español (sin selector de idioma). Carga los textos de lang/msg_es.js, Blockly_es.js y Arduino_es.js.
var Code = {};
Code.LANG = 'es';
window.localStorage.lang = Code.LANG;
Code.initLanguage = function() {
  $("html").attr('dir', 'ltr');
  $("html").attr('lang', Code.LANG);
  $('#aboutBody').text(MSG['aboutBody']);
  $('#aboutModalLabel').text(MSG['aboutModalLabel']);
  $('#aboutusbLabel').text(MSG['aboutusbLabel']);
  $('#survol').text(MSG['survol']);
  $('#span_site').text(MSG['span_site']);
  $('#span_forum').text(MSG['span_forum']);
  $('#span_contact').text(MSG['span_contact']);
  $('#span_update').text(MSG['span_update']);
  $('#span_verify_update').text(MSG['span_verify_update']);
  $('#btn_preview').attr('title', MSG['btn_preview_ino']);
  $('#btn_saveino').attr('title', MSG['btn_save_ino']);
  $('#btn_copy').attr('title', MSG['btn_copy']);
  $('#btn_undo').attr('title', MSG['btn_undo']);
  $('#btn_redo').attr('title', MSG['btn_redo']);
  $('#btn_new').attr('title', MSG['btn_new']);
  $('#btn_saveXML').attr('title', MSG['btn_saveXML']);
  $('#btn_fakeload').attr('title', MSG['btn_fakeload']);
  $('#btn_term').attr('title', MSG['btn_term']);
  $('#btn_buscar').attr('title', MSG['btn_buscar']);
  $('#btn_tour').attr('title', MSG['btn_tour']);
  $('#buscar_bloques').attr('placeholder', MSG['buscar_placeholder']);
  $('#btn_example').attr('title', MSG['btn_example']);
  $("xml").find("category").each(function() {
    if (!$(this).attr('id')) {
      $(this).attr('id', $(this).attr('name'));
      $(this).attr('name', Blockly.Msg[$(this).attr('name')]);
    }
  });
};
document.write('<script src="lang/msg_' + Code.LANG + '.js"></script>\n');
document.write('<script src="lang/Blockly_' + Code.LANG + '.js"></script>\n');
document.write('<script src="lang/Arduino_' + Code.LANG + '.js"></script>\n');
