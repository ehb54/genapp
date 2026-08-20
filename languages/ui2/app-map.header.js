(function () {
  "use strict";

  const app = {
    title: "__title__",
    application: "__application__",
    generatedOn: "__generatedon__",
    appRevision: "__apprevision__",
    genappRevision: "__revision__",
    directives: {},
    help: {},
    menus: [],
    menuById: {}
  };

__~xsedeproject{app.directives.xsedeproject = "__xsedeproject__";}
__~sharing{app.directives.sharing = "__sharing__";}
__~usertheme{app.directives.usertheme = "__usertheme__";}
__~usercolors{app.directives.usercolors = "__usercolors__";}
__~nextjobenvironment{app.directives.nextjobenvironment = "__nextjobenvironment__";}
__~docsbaseurl{app.directives.docsbaseurl = "__docsbaseurl__";}
__~ui2_account_avatar{app.directives.ui2_account_avatar = "__ui2_account_avatar__";}
__~ui2_plotly_chart_editor{app.directives.ui2_plotly_chart_editor = "__ui2_plotly_chart_editor__";}
__~ui2_plotly_chart_editor_url{app.directives.ui2_plotly_chart_editor_url = "__ui2_plotly_chart_editor_url__";}
__~ui2_plotly_chart_editor_target{app.directives.ui2_plotly_chart_editor_target = "__ui2_plotly_chart_editor_target__";}
__~help:user_config{app.help.user_config = "__help:user_config__";}
__~help:register{app.help.register = "__help:register__";}
__~help:jobs{app.help.jobs = "__help:jobs__";}
__~help:files{app.help.files = "__help:files__";}
__~help:feedback{app.help.feedback = "__help:feedback__";}
__~help:docs{app.help.docs = "__help:docs__";}
__~help:login{app.help.login = "__help:login__";}
__~help:logoff{app.help.logoff = "__help:logoff__";}
__~help:help{app.help.help = "__help:help__";}
__~help:project{app.help.project = "__help:project__";}
__~help:menu{app.help.menu = "__help:menu__";}
__~help:submit{app.help.submit = "__help:submit__";}
__~help:reset{app.help.reset = "__help:reset__";}

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

  app.setMenuHelp = function (id, help) {
    if (app.menuById[id]) {
      app.menuById[id].help = help || "";
    }
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
