var app = {};
app.safari = navigator.userAgent.indexOf('Safari') != -1 && navigator.userAgent.indexOf('Chrome') == -1;
app.courses = [];
app.courses_generator = null;
app.mode = "Manual";
app.hovering = [];
app.currentstorage = null;
app.localStorage = [];
app.terms = [];
app.term = "";
app.courses = [];
app.courses_auto = [];
app.courses_manual = [];
app.course = null;
app.courses_list = [];
app.course_list_selection = 0;
app.savedCourseGenerator = "0";
app.selected = [];
app.closed = false;
let change_style = function(styleSlider){
    document.styleSheets[1].disabled = !styleSlider.checked;
    localStorage.darkMode = styleSlider.checked.toString();
}
