/* MPR: correcciones sobre Blockly (blockly.min.js no se modifica). */
(function () {
  if (typeof Blockly === 'undefined' || !Blockly.FieldDropdown) return;
  var MARGEN = 8;
  // Listas largas: limitar el alto al espacio disponible y ubicarlas pegadas al campo
  Blockly.FieldDropdown.prototype.showEditor_ = function () {
    Blockly.WidgetDiv.show(this, this.sourceBlock_.RTL, null);
    var thisField = this;
    var menu = new goog.ui.Menu();
    menu.setRightToLeft(this.sourceBlock_.RTL);
    var options = this.getOptions_();
    for (var i = 0; i < options.length; i++) {
      var value = options[i][1];
      var item = new goog.ui.MenuItem(options[i][0]);
      item.setRightToLeft(this.sourceBlock_.RTL);
      item.setValue(value);
      item.setCheckable(true);
      menu.addChild(item, true);
      item.setChecked(value == this.value_);
    }
    goog.events.listen(menu, goog.ui.Component.EventType.ACTION, function (e) {
      var menuItem = e.target;
      if (menuItem) thisField.onItemSelected(this, menuItem);
      Blockly.WidgetDiv.hideIfOwner(thisField);
    });
    menu.getHandler().listen(menu.getElement(), goog.events.EventType.TOUCHSTART, function (e) {
      this.getOwnerControl(e.target).handleMouseDown(e);
    });
    menu.getHandler().listen(menu.getElement(), goog.events.EventType.TOUCHEND, function (e) {
      this.getOwnerControl(e.target).performActionInternal(e);
    });
    var windowSize = goog.dom.getViewportSize();
    var scrollOffset = goog.style.getViewportPageOffset(document);
    var xy = this.getAbsoluteXY_();
    var borderBBox = this.getScaledBBox_();
    menu.render(Blockly.WidgetDiv.DIV);
    var menuDom = menu.getElement();
    Blockly.addClass_(menuDom, 'blocklyDropdownMenu');
    // Siempre hacia abajo, con el alto que quepa y barra de desplazamiento. Solo si
    // quedan menos de 90 px (bloque pegado abajo) se abre hacia arriba, sin tapar
    // la barra de título.
    var ALTO_MINIMO = 90;
    var bottom = scrollOffset.y + windowSize.height - MARGEN;
    var spaceBelow = bottom - (xy.y + borderBBox.height);
    var titleBar = document.getElementById('toptitle');
    var topLimit = scrollOffset.y + (titleBar ? titleBar.getBoundingClientRect().bottom : 0) + MARGEN;
    var spaceAbove = xy.y - topLimit;
    var below = spaceBelow >= ALTO_MINIMO || spaceBelow >= spaceAbove;
    menuDom.style.overflowY = 'auto';
    menuDom.style.overflowX = 'hidden';
    menuDom.style.maxHeight = Math.max(ALTO_MINIMO, below ? spaceBelow : spaceAbove) + 'px';
    var menuSize = goog.style.getSize(menuDom);
    menuSize.height = menuDom.offsetHeight;   // alto real ya limitado
    xy.y = below ? xy.y + borderBBox.height : xy.y - (menuSize.height + 2);
    if (this.sourceBlock_.RTL) {
      xy.x += borderBBox.width + Blockly.FieldDropdown.CHECKMARK_OVERHANG;
      if (xy.x < scrollOffset.x + menuSize.width) xy.x = scrollOffset.x + menuSize.width;
    } else {
      xy.x -= Blockly.FieldDropdown.CHECKMARK_OVERHANG;
      if (xy.x > windowSize.width + scrollOffset.x - menuSize.width) {
        xy.x = windowSize.width + scrollOffset.x - menuSize.width;
      }
    }
    Blockly.WidgetDiv.position(xy.x, xy.y, windowSize, scrollOffset, this.sourceBlock_.RTL);
    // El contenedor mide lo mismo que la lista (antes medía toda la ventana y
    // alargaba la página); y el scroll de la lista no pasa a la ventana.
    Blockly.WidgetDiv.DIV.style.height = menuDom.offsetHeight + 'px';
    menuDom.style.overscrollBehavior = 'contain';
    menu.setAllowAutoFocus(true);
    menuDom.focus();
    var checked = menuDom.querySelector('.goog-option-selected');
    if (checked && menuDom.scrollHeight > menuDom.clientHeight) {
      menuDom.scrollTop = checked.offsetTop - menuDom.clientHeight / 2;
    }
  };
})();
