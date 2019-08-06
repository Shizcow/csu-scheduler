// Google Analytics

var tagID = 'UA-142471442-2';

//first get the tag
var ref = document.getElementsByTagName( 'script' )[0];
var script = document.createElement( 'script' );
script.src = 'https://www.googletagmanager.com/gtag/js?id=' + tagID;
ref.parentNode.insertBefore( script, ref );

window.dataLayer = window.dataLayer || [];
/** @type {function(...*)} */
function gtag(var_args){window.dataLayer.push(arguments);}
gtag('js', new Date());

gtag('config', tagID);
