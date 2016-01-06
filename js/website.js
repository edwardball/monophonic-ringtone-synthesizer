$(".js-sidebar-toggle").click(function(e){
	e.preventDefault();
	$(".js-sidebar").toggleClass("sidebar-closed");
	$(".js-sidebar i").toggleClass("fa-arrow-circle-o-right").toggleClass("fa-arrow-circle-o-left");
});