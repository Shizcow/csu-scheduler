/* config.js
This file contains various configs for developing or modification

In the future, this file will contain all direct interactions with course objects
This will help others fork this tool to work with other colleges with much less effort
*/
let app_config = {}; // used for namespace and definition order reasons

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
