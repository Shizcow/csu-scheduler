//Generate the next valid schedule and apply it to the board, if possible
app.genNext = function(button){
    if(app.courses_generator && app.courses_generator.get(app.courses_generator.data ? app.courses_generator.data.length : 0)){ // see if there's more we haven't seen yet
	this.course_list_selection = (app.courses_generator.data ? app.courses_generator.data.length : 0)-1; // and show it to us
    } else { // done - start looping
	this.course_list_selection++;
	this.course_list_selection%=(app.courses_generator ? app.courses_generator.data.length : 0);
    }
    this.fillSchedule();
    var range = document.getElementById("Range");
    range.max = app.courses_generator ? app.courses_generator.data.length-1 : 0;
    range.value = this.course_list_selection;

    button.innerText = (app.courses_generator ? app.courses_generator.done : false) ? "Loop" : "Next";
};

app.updateCredits = function() {
    document.getElementById("credits").innerText = this.totalCredits();
};


app.changedTerm = function(loadHash = false, referrer = null){
    if(!loadHash && referrer && this.changed())
        if (!window.confirm("Are you sure you want to discard your changes?")){
	    document.getElementById("termSelect").value = this.term;
	    return false;
	}
    if(this.currentstorage && loadHash != true)
	if(!this.clear()){ // user declined - fix selection box then return
	    document.getElementById("termSelect").value = this.term;
	    return;
	}
    if(referrer){
	if(referrer.firstChild.value == "") // clean up on first get
	    referrer.removeChild(referrer.firstChild);
	this.term = referrer.value;
    }
    if(!this.term)
	return; // empty
    this.course = null;
    document.getElementById("selectBox").value = "";
    document.getElementById("searchBox").value = "";
    this.selected = [];
    this.course_list_selection = 0;
    var range = document.getElementById('Range');
    range.max = 0;
    range.value = 0;
    app.courses_generator = null;
    this.savedCourseGenerator = "";
    if(loadHash != "first")
	this.fillSchedule(); // show empty while loading - don't need to on first load because it's already empty
    this.percent = "";

    document.getElementById("coursesBox").style.display = "none";
    document.getElementById("loadingCourses").style.display = "";
    //request new term to be loaded, and on success update UI
    app.termCacher.push(this.term, function(_loadHash){
	return function(courses){
	    // update UI
	    app.updateNotes(document.getElementById("notes")); // fix style in case notes have been cached
	    app.courses = courses;
	    app.genDivs();
	    if(_loadHash)
		app.loadHash(_loadHash === "first");
	    app.fillSchedule();
	    app.fillSearch();
	}
    }(loadHash));
};
app.genDivs = function(loadSelect = true){
    var courses_auto = app.courses.reduce(function(acc, cur){
	if(acc.length > 0){
	    if(cur.subjectCourse != acc[acc.length-1].subjectCourse){
		return acc.concat(cur); // add new
	    } else {
		return acc; // ignore duplicate
	    }
	} else {
	    return [cur]; // first iteration - set up accumulator
	}
    }, []);
    app.courses_manual = [];
    for(var i = 0; i < app.courses.length; i++){
	var c = app.courses[i];
	var el = document.createElement("option");
	el.textContent = c.subject + ' ' + c.courseNumber + ': ' + c.courseTitle;
	el.value = c.index;
	app.courses_manual.push(el);
    }
    app.courses_auto = [];
    for(var i = 0; i < courses_auto.length; i++){
	var c = courses_auto[i];
	var el = document.createElement("option");
	el.textContent = c.subject + ' ' + c.courseNumber + ': ' + c.courseTitle;
	el.value = c.index;
	app.courses_auto.push(el);
    }
    document.getElementById("coursesBox").style.display = "";
    document.getElementById("loadingCourses").style.display = "none";
};
app.updateTerms = function(){
    var selectBox = document.getElementById("termSelect");
    while(selectBox.lastChild)
	selectBox.removeChild(selectBox.lastChild);
    for(var i = 0; i < this.terms.length; i++){
	var term = this.terms[i];
	var option = document.createElement("option");
	option.value = term.code;
	option.innerText = term.description;
	selectBox.appendChild(option);
    }
    selectBox.value = this.term;
};


app.autoBar = function(){
    var autoBar = document.getElementById("autoBar");
    autoBar.style.display = this.mode == 'Automatic' && this.selected.concat(app.courses[this.course])[0] != null ? "inline-block" : "none";
    document.getElementById('nextButton').innerText='Next';
};
app.updatePercent = function(){
    document.getElementById("loadingCourses").innerText = "Loading Courses... " + this.percent;
};
app.updateNotes = function(noteBox){
    noteBox.style.height='25px';
    noteBox.style.height=(noteBox.scrollHeight+25)+'px';
    this.saveMarker();
};
