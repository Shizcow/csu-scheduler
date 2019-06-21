app.changed = function(){
    if(!this.selected.length)
	return false;
    var saves = document.getElementById("saves").children;
    var ret = true;
    var foundIdx = -1; // this has to be done manually because Dom Collections don't have it
    for(var i=0; i < saves.length; ++i)
	if(saves[i].classList.contains("selected")) // this will be BEFORE render change
	    foundIdx = i;
    if(foundIdx > -1)
	ret = this.localStorage[saves[foundIdx].innerText] != this.generateHash(true);
    //save coming from, vs actual classes on the board
    else // edge case - if we're coming from no save selected and it happens to be the same
	for(var i=0; i < saves.length; ++i)
	    if(saves[i].classList.contains("preselect")) // this will be AFTER render change
		ret = this.localStorage[saves[i].innerText] != this.generateHash(true);
    return ret;
};
app.loadHash = function(first){ // loading from URL or save, get hash and parse it
    var hashes = location.hash.split("=")[1].split("&")[0].split(",");
    this.selected = app.courses.filter(function(course){
	return hashes.indexOf(course.courseReferenceNumber.toString()) > -1;
    });
    document.getElementById("closedCheck").checked = !!location.hash.split("&")[1];
    this.closed = !!location.hash.split("&")[1];
    if(first){ // loading hash from URL - check if there's a save which matches, and if so select it
	// this will choose the firstmost schedule that matches
	var possible = [];
	for(var i=0,saves = document.getElementById("saves").children; i < saves.length; ++i)
	    if(this.localStorage[saves[i].innerText].split("+")[0] == location.hash.split("#")[1])
		possible.push(saves[i]);
	var lastMatch = possible.filter(function(element){ // sees if there's any save that was also most recently used
	    return app.localStorage[element.innerText].split("+")[0] + "!" + element.innerText == localStorage.lastSaved;
	});
	if(!possible.length){ // no matches - probably completly new
	    if((location.hash.split("&")[0].split("=")[1].length > 0) && (this.generateHash(false) != localStorage["lastViewed"])) // make sure there are actually some courses
		gtag('event', 'Schedules Shared'); // is completly new
	} else { // previous - load and update
	    (lastMatch.length ? lastMatch[0] : possible[0]).classList.add("selected"); // if we're reloading, go for the known correct schedule. Else, go for the first one to match
	    app.currentstorage = (lastMatch.length ? lastMatch[0] : possible[0]).innerText;
	}
    }
};

app.generateHash = function(includeNotes) {
    var hash = this.term + "=";
    hash += this.selected.map(function(s){
	return s.courseReferenceNumber;
    }).sort((a, b) => parseInt(a)-parseInt(b)).join();
    if(this.closed)
	hash += "&C";
    if(includeNotes === true)
	hash += "+" + document.getElementById("notes").value;
    return hash;
};
