;(function () {
    'use strict'

    // addEventsListener
    function addEventsListener(object, types, callback) {
        types.split(' ').forEach(type => object.addEventListener(type, callback))
    }

    // Vars.
    var $body = document.querySelector('body')

	window.addEventListener('load', function () {

 //----
		
		  // buttons
		  var btn_login = document.getElementById('btn-login');
		  var btn_logout = document.getElementById('btn-logout');

		btn_login.addEventListener('click', function(e) {
            e.preventDefault();
            webAuth.authorize({
            connection: 'facebook'}
            );
          });

		  btn_logout.addEventListener('click', function() {
			 logout();
			 window.location.href = "/";
		  });
          
          function handleAuthentication() {
			 console.log('Starting authentication...');
            webAuth.parseHash(function(err, authResult) {
               if (authResult && authResult.accessToken && authResult.idToken) {
                        window.location.hash = '';
                        setSession(authResult);
                      } else if (err) {
						  //alert(err);
                        logout();
                        console.log(err);
                      }
                    });
          }

          function setSession(authResult) {
                       
                // Set the time that the access token will expire at
                var expiresAt = JSON.stringify(authResult.expiresIn * 1000 + new Date().getTime());
                console.log('Saving tokens');
                localStorage.setItem('access_token', authResult.accessToken);
                localStorage.setItem('id_token', authResult.idToken);
                localStorage.setItem('expires_at', expiresAt);
                displayButtons();
                //displayProfile();
          }

          function logout() {
            // Remove tokens and expiry time from localStorage
            console.log('! Remove tokens')
            localStorage.removeItem('access_token');
            localStorage.removeItem('id_token');
            localStorage.removeItem('expires_at');
            displayButtons();
          }

          function isAuthenticated() {
            // Check whether the current time is past the
            // access token's expiry time
            var expiresAt = JSON.parse(localStorage.getItem('expires_at'));
            return new Date().getTime() < expiresAt;
          }

          function displayButtons() {
             console.log('Display buttons');
            if (isAuthenticated()) {
                  btn_login.style.display = 'none';
                  btn_logout.style.display = 'inline';
            } else {
                btn_login.style.display = "inline";
                btn_logout.style.display = "none";
            }
          }

		
          handleAuthentication();
 //-----

    });
	

    // Nav.
    var $nav = document.querySelector('#nav')
    var $navToggle = document.querySelector('a[href="#nav"]')
    var $navClose

    // Stats.
    var $stats = document.querySelector('#stats')
    var $statsToggle = document.querySelector('a[href="#stats"]')
    var $statsClose

    // Gym sidebar
    var $gymSidebar = document.querySelector('#gym-details')
    var $gymSidebarClose

    // Event: Prevent clicks/taps inside the nav from bubbling.
    addEventsListener($nav, 'click touchend', function (event) {
        event.stopPropagation()
    })

    if ($stats) {
        // Event: Prevent clicks/taps inside the stats from bubbling.
        addEventsListener($stats, 'click touchend', function (event) {
            event.stopPropagation()
        })
    }

    if ($gymSidebar) {
        // Event: Prevent clicks/taps inside the gym sidebar from bubbling.
        addEventsListener($gymSidebar, 'click touchend', function (event) {
            event.stopPropagation()
        })
    }

    // Event: Hide nav on body click/tap.
    addEventsListener($body, 'click touchend', function (event) {
        // on ios safari, when navToggle is clicked,
        // this function executes too, so if the target
        // is the toggle button, exit this function
        if (event.target.matches('a[href="#nav"]')) {
            return
        }
        if ($stats && event.target.matches('a[href="#stats"]')) {
            return
        }
        $nav.classList.remove('visible')
        if ($stats) {
            $stats.classList.remove('visible')
        }
    })
    // Toggle.

    // Event: Toggle nav on click.
    $navToggle.addEventListener('click', function (event) {
        event.preventDefault()
        event.stopPropagation()
        $nav.classList.toggle('visible')
    })

    // Event: Toggle stats on click.
    if ($statsToggle) {
        $statsToggle.addEventListener('click', function (event) {
            event.preventDefault()
            event.stopPropagation()
            $stats.classList.toggle('visible')
        })
    }

    // Close.

    // Create elements.
    $navClose = document.createElement('a')
    $navClose.href = '#'
    $navClose.className = 'close'
    $navClose.tabIndex = 0
    $nav.appendChild($navClose)

    if ($stats) {
        $statsClose = document.createElement('a')
        $statsClose.href = '#'
        $statsClose.className = 'close'
        $statsClose.tabIndex = 0
        $stats.appendChild($statsClose)
    }

    if ($gymSidebar) {
        $gymSidebarClose = document.createElement('a')
        $gymSidebarClose.href = '#'
        $gymSidebarClose.className = 'close'
        $gymSidebarClose.tabIndex = 0
        $gymSidebar.appendChild($gymSidebarClose)
    }

    // Event: Hide on ESC.
    window.addEventListener('keydown', function (event) {
        if (event.keyCode === 27) {
            $nav.classList.remove('visible')
            if ($stats) {
                $stats.classList.remove('visible')
            }
            if ($gymSidebar) {
                $gymSidebar.classList.remove('visible')
            }
        }
    })

    // Event: Hide nav on click.
    $navClose.addEventListener('click', function (event) {
        event.preventDefault()
        event.stopPropagation()
        $nav.classList.remove('visible')
    })

    if ($statsClose) {
        // Event: Hide stats on click.
        $statsClose.addEventListener('click', function (event) {
            event.preventDefault()
            event.stopPropagation()
            $stats.classList.remove('visible')
        })
    }

    if ($gymSidebarClose) {
        // Event: Hide stats on click.
        $gymSidebarClose.addEventListener('click', function (event) {
            event.preventDefault()
            event.stopPropagation()
            $gymSidebar.classList.remove('visible')
        })
    }
})()
