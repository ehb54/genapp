(function () {
  "use strict";

  const app = {
    title: "__title__",
    application: "__application__",
    directives: {},
    menus: [],
    menuById: {}
  };

__~xsedeproject{app.directives.xsedeproject = "__xsedeproject__";}
__~sharing{app.directives.sharing = "__sharing__";}
__~usertheme{app.directives.usertheme = "__usertheme__";}
__~usercolors{app.directives.usercolors = "__usercolors__";}

  app.addMenu = function (menu) {
    if (!menu || !menu.id || app.menuById[menu.id]) {
      return;
    }
    menu.modules = [];
    app.menuById[menu.id] = menu;
    app.menus.push(menu);
  };

  app.addMenuFromParts = function (id, label, icon) {
    app.addMenu({
      id: id,
      label: label || id,
      icon: icon || ""
    });
  };

  app.setMenuIcon = function (id, icon) {
    if (app.menuById[id]) {
      app.menuById[id].icon = icon || "";
    }
  };

  app.setMenuRestricted = function (id, restricted) {
    if (app.menuById[id]) {
      app.menuById[id].restricted = restricted || "";
    }
  };

  app.addModule = function (menuId, module) {
    if (!app.menuById[menuId]) {
      app.addMenu({ id: menuId, label: menuId });
    }
    app.menuById[menuId].modules.push(module);
  };

  window.GenAppUi2App = app;
