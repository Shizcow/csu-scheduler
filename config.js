/* config.js
This file contains various configs for developing or adapting to other colleges

The intent is to minimize the need to look around in other files when
adapting this for other colleges. Read through this entire file and
your job will be a lot easier. Each section has a small guide.

This file is split into sections, indicated by ascii art.
Those sections are as follows:
-Developer options
 L->Useful for testing non-production versions
-librequests URLS
 L->Used for configuring URLS for outgoing requests
-librequests processing
 L->Used to process incoming requests and construct course objects
*/

//config init -- don't touch this
let app_config = {}; // used for namespace and definition order reasons

/*_____  ________      ________ _      ____  _____  ______ _____  
 |  __ \|  ____\ \    / /  ____| |    / __ \|  __ \|  ____|  __ \ 
 | |  | | |__   \ \  / /| |__  | |   | |  | | |__) | |__  | |__) |
 | |  | |  __|   \ \/ / |  __| | |   | |  | |  ___/|  __| |  _  / 
 | |__| | |____   \  /  | |____| |___| |__| | |    | |____| | \ \ 
 |_____/|______|   \/   |______|______\____/|_|    |______|_|  \_\
                                                                  
   ____  _____ _______ _____ ____  _   _  _____ 
  / __ \|  __ \__   __|_   _/ __ \| \ | |/ ____|
 | |  | | |__) | | |    | || |  | |  \| | (___  
 | |  | |  ___/  | |    | || |  | | . ` |\___ \ 
 | |__| | |      | |   _| || |__| | |\  |____) |
  \____/|_|      |_|  |_____\____/|_| \_|_____/ 

This section contains options useful for non-production versions
*/

// Used for testing - out of a given term, this is how many courses are to be loaded
// A lower percentage means fewer courses, which means less functionality but faster loading & testing
app_config.test_percent_cap = 1;

// Used for performance tuning - for each large courses request, this is how many courses are requested
// A lower number means fewer courses requested per request and thus faster requests, but more requests overall
// For CSU, I've found that 300 gives the fastest loading times. However, the server will honor up to 500
app_config.chunk = 300;
//These values have been found from tested on my machine. Feel free to test yourself
//500---> Finish: 46.84s, 49.08s, 42.61s = 46.176s avg
//400---> Finish: 44.52s, 40.94s, 37.04s = 40.826s avg
//300---> Finish: 38.30s, 35.46s, 38.66s = 37.473s avg ***
//200---> Finish: 42.70s, 43.13s, 38.08s = 41.303s avg
//100---> Finish: 45.26s, 34.36s, 36.82s = 38.813s avg




/*_      _____ ____  _____  ______ ____  _    _ ______  _____ _______ _____ 
 | |    |_   _|  _ \|  __ \|  ____/ __ \| |  | |  ____|/ ____|__   __/ ____|
 | |      | | | |_) | |__) | |__ | |  | | |  | | |__  | (___    | | | (___  
 | |      | | |  _ <|  _  /|  __|| |  | | |  | |  __|  \___ \   | |  \___ \ 
 | |____ _| |_| |_) | | \ \| |___| |__| | |__| | |____ ____) |  | |  ____) |
 |______|_____|____/|_|  \_\______\___\_\\____/|______|_____/   |_| |_____/
  _    _ _____  _       _____ 
 | |  | |  __ \| |     / ____|
 | |  | | |__) | |    | (___  
 | |  | |  _  /| |     \___ \ 
 | |__| | | \ \| |____ ____) |
  \____/|_|  \_\______|_____/

Nessicary for handling URLS for outgoing requests
VERY important for making this work with other colleges
This area will need the most tweaking, and librequests.js might 
need some as well

IMPORTANT NOTE:
The first step in adapting this for another college is getting data
to come through in the first place. Here's a rough gide on how to do that.

1) Find out where the courses data server is located
This can be done a few ways, but the easiest way is through dev tools in
your browser. Open it and start looking at network traffic. Then, head
to your college's course catalogue or registration site. Somewhere
that courses are loaded in a big list and you can search through them.
Then, get to the point where you're about to load some courses. Clear
the network traffic log, then load in some courses. You'll see some
requests coming in. Sort through them until you find the one (or more)
that contain course JSON data. If your college doesn't use JSON, good luck.
Note the URL where the JSON comes from. This is the data server.

2) Find the URLprefix
Repeat step 1 with a few different things. Try loading what terms are
available for registration, courses, descriptions, etc. All the URLs
should have a common prefix. If they don't, they do, even if it's just
'https://' -- fill this out below as app_config.URLprefix.

3) Find URL patterns
Now that you have a list of URLs for getting data, start looking at them closer.
You'll notice some patterns when requesting courses. For CSU, it's
like this after the prefix:
searchResults/searchResults?txt_term=TERMCODE&startDatepicker=&endDatepicker=&pageOffset=START&pageMaxSize=CHUNK&sortColumn=subjectDescription&sortDirection=asc
-where TERMCODE is the code used to specify what term courses are coming from
-where START is where we want to start from in the big master list of courses
-where CHUNK is how many courses we want to load
Now, figure out what these patterns are for available terms, courses in each term,
and (if applicable) where you can find course descriptions. Fill these in as:
app_config.URLgetTerms()
app_config.URLgetCourses()
app_config.URLgetDescription()
Now, if these are all GET requests, easy. If they're post requests, pay attention
to the parameters too, you can fill those in too. Use the GETPOST parameter.

4) Get it working by itself
Now that you have all the URLS you need, you need to be able to actually make requests.
Why is this important to note? Some colleges require session authentication cookies,
which make it impossible to come out of the blue and request courses, but possible
to request courses on the college's website. This is usually done through a request
on each session, or a request on each term change. In order to handle both of these
scenarios, there are two built in request functions. They are as follows:
app_config.URLtest() and app_config.URLprime()
URLtest  deals with the session approach
URLprime deals with the term    approach
They can be used together, appart, or not at all. At this point, figure out what
requests you need to make in order to make term and course requests off of the
official site. Then fill out:
app_config.URLtest()
app_config.URLprime()

After these steps, you should be able to get JSON incoming. Check the network traffic
for this page while it's trying to load terms. For now, ignore errors in the JS console
and things breaking on the page. The important part is being able to check each request
and see JSON coming in properly. If you can get this to work, continue on to the next section
*/

// app_config.URLprefix
// The common URL prefix for all incoming data from your university's server
// should look like 'https://server.college.edu/courseCommon/'
// every request will start with this string, and have data appended to it
// if you have a special case, it can be addressed in specific functions
// this is for convienence only
app_config.URLprefix = 'https://bannerxe.is.colostate.edu/StudentRegistrationSsb/ssb/';

// app_config.URLgetTerms()
// This function is used to get the URL needed for querying available terms
// the response of which will be processed in app_config.PROCESSgetTerms()
//
// this is where the GETPOST parameter is introduced. It has three important members
// that MUST be set:
// 1) url
//    L-> the URL which the request takes place
// 2) openMethod
//    L-> must be set to either "GET" or "POST", which corresponds to the needed request type
// 3) postData
//    L-> used when openMethod is "POST", and contains the data to post
//    L-> may be left as null if not a POST request
app_config.URLgetTerms = function(GETPOST){
    GETPOST.openMethod = "GET";
    // GET request - no need to set postData
    GETPOST.url = app_config.URLprefix + "classSearch/getTerms?searchTerm=&offset=1&max=100&_=1554348528566";
}

// app_config.URLgetCourses
// This function is used to get the URL needed for quering courses residing in a specific term
// this function takes three additional parameters:
// 1) "termCode", which is the URL code used to represent a term in a term request.
//     termCode is calculated in app_config.PROCESSgetTerms
// 2) "offset", which is passed as a decimal number, which represents the starting index of the
//     desired chunk in a master list of all courses
// 3) "size", which is passed as a decimal number, which represents the total number
//     of courses being requested
// offset and size are automatically generated and handled in librequests.js
app_config.URLgetCourses = function(GETPOST, termCode, offset, size){
    GETPOST.openMethod = "GET";
    GETPOST.url = app_config.URLprefix + "searchResults/searchResults?txt_term=" + termCode + "&startDatepicker=&endDatepicker=&pageOffset=" + offset.toString() + "&pageMaxSize=" + size.toString() + "&sortColumn=subjectDescription&sortDirection=asc";
}

// app_config.URLgetDescription
// This function is used to get the URL needed for quering a course description
// this function takes two additional parameters:
// 1) "termCode", which is the URL code used to represent a term in a term request.
//     termCode is calculated in app_config.PROCESSgetTerms
// 2) "courseReferenceNumber", which is the URL code representing a course ID
app_config.URLgetDescription = function(GETPOST, termCode, courseReferenceNumber){
    GETPOST.openMethod = "POST";
    GETPOST.url = app_config.URLprefix + "searchResults/getCourseDescription";
    GETPOST.postData = "term=" + termCode + "&courseReferenceNumber=" + courseReferenceNumber;
}

// app_config.URLtest
// This function returns the URL needed for two things
// 1) setting session auth cookies
// 2) testing whether or not we're being blocked by CORS
//     During development, you'll probbaly be blocked by CORS and will need an extension to disable it
//     This function decides whether or not you need that extension
// so you must make a requst here, even if it's to the course main page
// This function is activated only once, on load of the webpage
app_config.URLtest = function(GETPOST){
    GETPOST.openMethod = "GET";
    GETPOST.url = app_config.URLprefix;
}

// app_config.URLprime
// This function is used to get the URL needed for "priming" a request,
// or asking the server for cookies needed to make requests.
// This function is activated on every term change before requesting courses
// This function takes an additional parameter:
//  "termCode", which is the URL code used to represent a term in a term request.
//   termCode is calculated in app_config.PROCESSgetTerms
app_config.URLprime = function(GETPOST, termCode){
    GETPOST.openMethod = "POST";
    GETPOST.url = app_config.URLprefix + "term/search?mode=search";
    GETPOST.postData = "term=" + termCode + "&studyPath=&studyPathText=&startDatepicker=&endDatepicker="
}


/*_      _____ ____  _____  ______ ____  _    _ ______  _____ _______ _____ 
 | |    |_   _|  _ \|  __ \|  ____/ __ \| |  | |  ____|/ ____|__   __/ ____|
 | |      | | | |_) | |__) | |__ | |  | | |  | | |__  | (___    | | | (___  
 | |      | | |  _ <|  _  /|  __|| |  | | |  | |  __|  \___ \   | |  \___ \ 
 | |____ _| |_| |_) | | \ \| |___| |__| | |__| | |____ ____) |  | |  ____) |
 |______|_____|____/|_|  \_\______\___\_\\____/|______|_____/   |_| |_____/
  _____  _____   ____   _____ ______  _____ _____ _____ _   _  _____ 
 |  __ \|  __ \ / __ \ / ____|  ____|/ ____/ ____|_   _| \ | |/ ____|
 | |__) | |__) | |  | | |    | |__  | (___| (___   | | |  \| | |  __ 
 |  ___/|  _  /| |  | | |    |  __|  \___ \\___ \  | | | . ` | | |_ |
 | |    | | \ \| |__| | |____| |____ ____) |___) |_| |_| |\  | |__| |
 |_|    |_|  \_\\____/ \_____|______|_____/_____/|_____|_| \_|\_____|

This sections is used for processing incoming data and preparing it to work
with the rest of the source code.
*/
