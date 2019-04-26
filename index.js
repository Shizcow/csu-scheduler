//This file is meant to fill the tedious html layouts

(function(){
    var thead = document.getElementById("schedThead");
    var days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    for(var i=0; i<days.length; ++i){
	var day = days[i];
	var td = document.createElement("td");
	td.innerText = day;
	thead.appendChild(td);
    }
})();

(function(){ // tbody body
    var tbody = document.getElementById("schedTbody");
    var hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    var days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    var tr_template = document.createElement("tr"); // CSS says Saturday & Sunday are hidden
    var td0 = document.createElement("td");
    td0.className = "time";
    //td0.innerText = ((hour - 1) % 12 + 1) + ':00';
    tr_template.appendChild(td0);

    var td_template = document.createElement("td");
    td_template.className = "block";
    var div0 = document.createElement("div");
    div0.className = "wrapper";
    var div00 = document.createElement("div");
    div00.className = "wrapperInternal";
    //div00.data-hour = hour, div00.data-day = day
    div0.appendChild(div00);
    div0.appendChild(document.createElement("div"));
    div0.appendChild(document.createElement("div"));
    td_template.appendChild(div0);
    
    for(var i=0; i<hours.length; ++i){
	var hour = hours[i];
	var tr = tr_template.cloneNode(true);
	tr.firstChild.innerText = ((hour - 1) % 12 + 1) + ':00';
	for(var j=0; j<days.length; ++j){
	    var day = days[j];
	    var td = td_template.cloneNode(true);
	    td.firstChild.firstChild.setAttribute("data-hour", hour);
	    td.firstChild.firstChild.setAttribute("data-day", day);
	    tr.appendChild(td);
	}
	tbody.appendChild(tr);
    }
})();
