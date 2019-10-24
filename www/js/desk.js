window.desk = {
	init: function () {
		//alert("go");
		desk.start();
		common.handle_external_links();
	},
	init_fcm: function () {
		// FCMPlugin.onTokenRefresh(function (token) {
		// 	console.log("TOKEN FCM:" + token);
		// });
		// FCMPlugin.getToken(function (token) {
		// 	console.log("TOKEN FCM:" + token);
		// });

		// FCMPlugin.subscribeToTopic('notifjasaERP');
		// FCMPlugin.onNotification(function (data) {
		// 	console.log("MASUK ON NOTIF!!!");
		// 	navigator.notification.alert("Tes", () => { });

		// 	if (data.wasTapped) {
		// 		//Notification was received on device tray and tapped by the user.
		// 		console.log("NOTIFIKASI MASUK!!");
		// 		console.log(JSON.stringify(data));
		// 	} else {
		// 		//Notification was received in foreground. Maybe the user needs to be notified.
		// 		console.log("NOTIFIKASI MASUK!!");
		// 		console.log(JSON.stringify(data));
		// 	}
		// });
	},
	start: function (version) {

		var url = localStorage.server + "/api/method/frappe.www.desk.get_desk_assets";
		if (version && version === "v6") {
			url = localStorage.server + "/api/method/frappe.templates.pages.desk.get_desk_assets";
		}

		$.ajax({
			method: "GET",
			url: url,
			data: {
				build_version: localStorage._build_version || "000"
			}
		}).success(function (data) {
			// desk startup
			window._version_number = data.message.build_version;
			window.app = true;
			if (!window.frappe) { window.frappe = {}; }
			window.frappe.list_desktop = false; //cordova.platformId === "ios";
			window.frappe.boot = data.message.boot;
			window.dev_server = data.message.boot.developer_mode;

			if (cordova.platformId === "ios") {
				document.addEventListener("deviceready", function () {
					StatusBar.backgroundColorByHexString("#f5f7fa");
				});
			}

			if (localStorage._build_version != data.message.build_version) {
				localStorage._build_version = data.message.build_version;
				common.write_file("assets.txt", JSON.stringify(data.message.assets));
				desk.desk_assets = data.message.assets;
			}

			if (!desk.desk_assets) {
				common.read_file("assets.txt", function (assets) {
					desk.desk_assets = JSON.parse(assets);
					desk.setup_assets();
				});
			}
			else {
				desk.setup_assets();
			}

		}).error(function (e) {
			if (![403, 401].includes(parseInt(e.status))) {
				alert(`${localStorage.server} failed with status ${e.status}`);
			}
			desk.logout();
		});
	},
	setup_assets: function () {

		for (key in desk.desk_assets) {
			var asset = desk.desk_assets[key];
			if (asset.type == "js") {
				common.load_script(asset.data);
			} else {
				var css = asset.data.replace(/url['"\(]+([^'"\)]+)['"\)]+/g, function (match, p1) {
					var fixed = (p1.substr(0, 1) === "/") ? (localStorage.server + p1) : (localStorage.server + "/" + p1);
				});
				common.load_style(css);
			}
		}

		desk.load_custom_css();

		// start app
		// patch urls
		frappe.request.url = localStorage.server + "/";
		frappe.base_url = localStorage.server;
		common.base_url = localStorage.server;

		// render the desk
		frappe.start_app();

		// Override mobile
		desk.make_notification_dropdown();

		// override logout
		frappe.app.redirect_to_login = desk.logout;
	},
	logout: function () {
		// Detach device
		FCMPlugin.getToken(function (token){
			var device_uuid = window.device.uuid;
			var url = localStorage.server + "/api/method/frappe.email.doctype.notification.notification.dettach_user_device";
			$.ajax({
				method: "POST",
				url: url,
				data: {
					token: token,
					device_uuid: device_uuid
				}
			}).success(function (data) { 
				// console.log("attach device " + device_name + " success");
				console.log("dettach success", data.message);
				localStorage.removeItem('session_id');
				window.location = "index.html"
			}).error(function(request, status, error) {
				console.log("dettach error", request.responseText);
			});
		})
		
	},
	test_print: function () {
		// printObj = {
		// 	text: "Star Clothing Boutique\n123 Star Road\nCity, State 12345\n\n",
		// 	cutReceipt: "true",
		// 	openCashDrawer: "true"
		// }
		// starprnt.printRawText("BT:mPOP", "StarLine", printObj, function (result) {
		// 	console.log(result);
		// },
		// 	function (error) {
		// 		console.log(error);
		// 	});
	},
	make_notification_dropdown(){
		// Tambah button notif
		$(`
			<li class="visible-xs">
				<a class="navbar-notification-button" href="#" data-toggle="modal" data-target="#notification-modal" style="font-size: 12pt; color: gray;">
					<i class="fa fa-bell"></i>
					<div class="unread-indicator" style="display: none"></div>
				</a>
			</li>
		`).insertAfter("li.dropdown-navbar-user");
		$("li.dropdown-help").remove();

		// Tambah modal notif
		$(`
			<div id="notification-modal" class="modal fade" role="dialog" aria-hidden="true" style="display: none;">
				<div class="modal-dialog" style="height: 50px;">
					<div class="modal-content">
						<div class="modal-header">
							<b>Notification List</b>
							<button type="button" class="close" data-dismiss="modal" aria-label="Close">
								<span aria-hidden="true">&times;</span>
							</button>
						</div>
						<div class="modal-body" style="background: white;">
							<div class="notification-list-container">
							</div>
						</div>
						<div class="modal-footer" style="background: white; padding: 5px; 8px">
							<a style="color: gray" id="btn-clear-notification">Clear All Notification</a>
						</div>
					</div>
				</div>
			</div>
		`).insertAfter("#search-modal")

		$('#notification-modal').on('show.bs.modal', function () {
			
		});

		$("#btn-clear-notification").click(()=>{
			frappe.call({
				method: "frappe.email.doctype.notification.notification.delete_notification",
				args:{
					user: frappe.session.user
				},
				callback: load_notifications
			});
		})

		// Notification Observer
		function load_notifications(){
			frappe.call({
				method: "frappe.email.doctype.notification.notification.get_user_notification",
				args:{
					user: frappe.session.user
				},
				callback: (res)=>{
					if(!res || !res.message || res.message.length == 0 ){
						$("#notification-modal .notification-list-container").html(`
							<div style="padding: 15px 5px; text-align: center">
								No Notification
							</div>
						`);
					} else {
						var new_list = "";
						$(".navbar-notification-button .unread-indicator").hide();
						res.message.forEach(notif => {
							let doc_url = decodeURI(notif.reference.split("#")[1]);
							new_list += `
								<div class="notification-list-wrapper" data-dismiss="modal" onclick="desk.open_redirect_url('` + doc_url + `', '` + notif.name + `')">
									` + (notif.is_read == 0 ? `<div class="notification-unread-indicator pull-right" ></div>` : "") + `
									<div class="notification-time pull-right">` + common.prettyDate(moment(notif.creation)) + `</div>
									<div class="notification-title"><b>` + notif.title + `</b></div>
									<div class="notification-body">` + notif.body + `</div>
								</div>
							`
							if(notif.is_read == 0)
								$(".navbar-notification-button .unread-indicator").show();
						});
						$("#notification-modal .notification-list-container").html(new_list);
					}
				},
				error: ()=>{
					$("#notification-modal .notification-list-container").html(`
						<div style="padding: 15px 5px; text-align: center">
							No Notification
						</div>
					`);
				}
			});
		}

		

		setInterval(load_notifications, 5000);
		load_notifications();
	},
	open_redirect_url(url, notification_name){
		frappe.call({
			method: "frappe.email.doctype.notification.notification.read_notification",
			args:{
				user: frappe.session.user,
				notification_name: notification_name
			}
		});
		if(window.frappe && window.frappe.set_route){
			window.frappe.set_route(url);
		}
	},
	load_custom_css(){
		// Custom CSS for mobile
		common.load_style(`
			[data-fieldtype="Table"]{
				overflow-x: scroll;
			}

			[data-fieldtype="Table"] div.form-grid{
				width: 1000px;
			}

			[data-fieldtype="Table"] div.form-in-grid{
				width: calc(100vw - 20px);
				position: fixed;
				top: 100px;
			}

			[data-fieldtype="Table"] .grid-form-body{
				max-height: calc(80vh - 100px);
				overflow-y: scroll;
			}

			.tree li{
				display: flex;
				flex-direction: column;
			}

			ul.tree-children {
				margin-left: 10px;
			}

			.tree-node > span.pull-right {
				margin-left: 13px;
			}

			.tree-node-toolbar{
				margin: 3px;
			}

			.navbar-notification-button .unread-indicator{
				width: 10px;
				height: 10px;
				background-color: red;
				position: absolute;
				margin-top: -10px;
				border-radius: 50%;
				margin-left: 8px;
				border: 2px solid white;
			}

			#notification-modal .notification-time{
				color: gray;
			}

			#notification-modal .modal-body{
				padding: 0;
				max-height: 70vh;
				overflow-y: scroll;
			}

			#notification-modal .notification-body{
				line-height: 10pt;
			}
			
			#notification-modal .notification-list-wrapper{
				font-size: 9pt;
				border-bottom: 1px solid rgb(224, 224, 224);
				padding: 8px;
			}

			#notification-modal .notification-unread-indicator{
				width: 8px;
				height: 8px;
				background-color: red;
				border-radius: 50%;
				margin-left: 5px;
			}
		`);
	}
}

$(document).ready(function () { desk.init() });
