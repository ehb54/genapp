/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.repeats = {};

ga.repeats.cache            = {};
ga.repeats.cache._jmol_info = {};
ga.repeats.cache.specproj   = [];

ga.repeats.save = function() {
    __~debug:repeat{console.log( "ga.repeats.save()" );}
    ga.repeats.cache._jmol_info = _jmol_info || {};
    ga.repeats.cache.specproj   = ga.specproj.data || [];
};

ga.repeats.restore = function() {
    __~debug:repeat{console.log( "ga.repeats.restore()" );}
    _jmol_info = ga.repeats.cache._jmol_info;
    ga.specproj.data = ga.repeats.cache.specproj;
};
