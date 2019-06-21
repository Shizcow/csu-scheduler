app.mounted = function(){
    //style first
    if(localStorage.darkMode == undefined) localStorage.darkMode = "false";
    var styleSlider = document.getElementById("styleSlider");
    styleSlider.checked = localStorage.darkMode == "true";
    change_style(styleSlider);

    //then auto mode in radio selection is cached - similar for closed
    this.mode = document.getElementById("Manual").checked ? "Manual" : "Automatic";
    this.closed = Boolean(location.hash.split("&")[1]);
    document.getElementById("closedCheck").checked = this.closed;
    
    document.getElementById("noSchedWrapper").style.display = "none";
    //check CORS
    (new Searcher("test")).start(function(success){
	if(success){
	    document.getElementById("loading").style.display = "none";
	    document.getElementById("main").style.display = "";
	} else {
	    document.getElementById("loading").style.display = "none";
	    document.getElementById("cors").style.display = "";
	}
    });
    (new Searcher("terms")).start(function(response){ // grab terms
	app.terms = response;
	if (location.hash.match(/#\d+=[\d+,?]+/) && (index = app.terms.map(el => el.code).indexOf(location.hash.split("=")[0].substr(1))) > -1){ //need to load from url
	    app.term = app.terms[index].code;
	    app.updateTerms();
	    app.changedTerm("first");
	} else {
	    app.term = app.terms[0].code;
	    app.updateTerms();
	    app.changedTerm(false);
	}
	document.getElementById("termSelect").value = app.term;
	if(localStorage.schedules)
	    app.localStorage = JSON.parse(localStorage.schedules);
	app.updateSaved();
    });


    // set up genNext / loop button longpress controls
    var button = document.querySelector("#nextButton");
    // Listening for the mouse and touch events    
    button.addEventListener("mousedown", pressingDown, false);
    button.addEventListener("mouseup", notPressingDown, false);
    button.addEventListener("mouseleave", notPressingDown, false);
    
    button.addEventListener("touchstart", pressingDown, false);
    button.addEventListener("touchend", notPressingDown, false);

    var waiter = null;
    function pressingDown(e) {
	app.genNext(button);
	waiter = setTimeout(doSomething, 750);
    }
    
    function notPressingDown(e) {
	clearTimeout(waiter);
	waiter = null;
    }
    
    function doSomething(e) {
	app.genNext(button);
	waiter = setTimeout(doSomething, 50);
    }
};

app.mounted();
