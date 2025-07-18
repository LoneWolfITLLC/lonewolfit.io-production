let hasExecuted = false;
let authNeeded = false; // Track if authentication is needed
let requireLogin = false; // Set this to true if you want to require the user to be logged in to view the page.
let loggedIn = false; // Track if the user is logged in
let redirectToPortal = false; // Set this to true if you want to redirect to portal on auth success
let requireUserToBeAdmin = false; // Set this to true if you want to require the user to be an admin to view the page.
const URL_BASE = "https://www.lonewolfit.io:2096";
const ADMIN_PATH = "admin.html";
const MEMBER_PATH = "members.html";
const triggerDarkModeEvent = new CustomEvent("triggerDarkMode");

function executeOnLoad() {
  if (!hasExecuted) {
    hasExecuted = true;
    // Redirect if loaded on port 2096 or URI contains :2096
    if (
      window.location.port === "2096" ||
      window.location.href.includes(":2096")
    ) {
      const url = new URL(window.location.href);
      url.port = "";
      window.location.replace(url.toString());
      return;
    }
    const preAuthEvent = new CustomEvent("preAuthChecked");
    window.dispatchEvent(preAuthEvent);
    onLoad();
    console.log("onLoad executed successfully.");
  }
}

window.addEventListener("pageshow", executeOnLoad);
window.addEventListener("popstate", executeOnLoad);
window.addEventListener("DOMContentLoaded", (event) => {
  if (!hasExecuted) {
    hasExecuted = true;
    const preAuthEvent = new CustomEvent("preAuthChecked");
    window.dispatchEvent(preAuthEvent);
    onLoad();
  }
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted && !hasExecuted) {
    console.log("Page restored from back-forward cache.");
    hasExecuted = true;
    const preAuthEvent = new CustomEvent("preAuthChecked");
    window.dispatchEvent(preAuthEvent);
    onLoad();
  }
});
window.addEventListener("unload", (event) => {
  hasExecuted = false;
});

//––––– loading modal toggles –––––
function showLoading() {
  const loadingModal = document.getElementById("loadingModal");
  if (loadingModal) loadingModal.style.display = "flex";
}
function hideLoading() {
  const loadingModal = document.getElementById("loadingModal");
  if (loadingModal) loadingModal.style.display = "none";
}
function getTokenFromSession() {
  const token = sessionStorage.getItem("jwt");
  console.log(`Retrieved token from session...`);
  return token ? token : null;
}
async function checkAuthentication(token) {
  if (!token) {
    if (requireLogin) {
      window.location.href =
        "login.html?redirect_uri=" +
        window.location.pathname.replace(/^\//, "") +
        "#emailloginSection";
      return false;
    }
    return null;
  }
  try {
    showLoading();
    const res = await fetch(`${URL_BASE}/api/auth/check-auth`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    hideLoading();
    if (!res.ok) {
      if (requireLogin) {
        //If the pathname is NOT the same as ADMIN_PATH or MEMBER_PATH, redirect to login
        if (
          !window.location.pathname.trim().endsWith(ADMIN_PATH) &&
          !window.location.pathname.trim().endsWith(MEMBER_PATH)
        ) {
          window.location.href =
            "login.html?redirect_uri=" +
            window.location.pathname.replace(/^\//, "") +
            "#emailloginSection";
        } else {
          window.location.href = "login.html" + "#emailloginSection";
        }
        return false;
      }
      return null;
    }
    const data = await res.json();
    return data;
  } catch (err) {
    hideLoading();
    console.error(err);
    if (requireLogin) {
      window.location.href =
        "login.html?redirect_uri=" +
        window.location.pathname.replace(/^\//, "") +
        "#emailloginSection";
      return null;
    }
    return null;
  }
}
async function onLoad() {
  const token = getTokenFromSession();
  const logged = await checkAuthentication(token);
  authNeeded = logged === null;
  loggedIn = logged !== null;
  if (loggedIn && logged) {
    const urlParams = new URLSearchParams(window.location.search);
    const redirectUri = urlParams.get("redirect_uri");
    const adminUser = logged.user.adminUser;
    // Clean up redirect_uri if already on the correct portal
    if (
      adminUser &&
      window.location.pathname.endsWith(ADMIN_PATH) &&
      redirectUri
    ) {
      // Only keep redirect_uri if it's not members.html or admin.html
      if (redirectUri === ADMIN_PATH || redirectUri === MEMBER_PATH) {
        urlParams.delete("redirect_uri");
        const newUrl =
          window.location.pathname +
          (urlParams.toString() ? "?" + urlParams.toString() : "") +
          window.location.hash;
        window.history.replaceState({}, document.title, newUrl);
      }
    } else if (
      !adminUser &&
      window.location.pathname.endsWith(MEMBER_PATH) &&
      redirectUri
    ) {
      if (redirectUri === ADMIN_PATH || redirectUri === MEMBER_PATH) {
        urlParams.delete("redirect_uri");
        const newUrl =
          window.location.pathname +
          (urlParams.toString() ? "?" + urlParams.toString() : "") +
          window.location.hash;
        window.history.replaceState({}, document.title, newUrl);
      }
    }

    if (adminUser) {
      if (redirectUri && !redirectToPortal) {
        window.location.href = redirectUri;
      } else if (
        redirectToPortal &&
        !window.location.pathname.endsWith(ADMIN_PATH) &&
        !requireLogin
      ) {
        window.location.href = ADMIN_PATH;
      }
    } else {
      if (redirectUri && !redirectToPortal) {
        window.location.href = redirectUri;
      } else if (
        (redirectToPortal &&
          !window.location.pathname.endsWith(MEMBER_PATH) &&
          !requireLogin) ||
        (requireUserToBeAdmin &&
          !adminUser &&
          !window.location.pathname.endsWith(MEMBER_PATH))
      ) {
        window.location.href = MEMBER_PATH;
      }
    }

    // If already on /members.html, do not redirect
  } else if (token) {
    //delete token stored here...
    sessionStorage.removeItem("jwt");
    console.log("Removed old, broken session key...");
  } else {
    console.log("Login needed (auth failed)...");
  }
  const authEvent = new CustomEvent("authChecked", {
    detail: {
      loggedIn,
      authNeeded,
      user: logged ? logged.user : null,
    },
  });
  window.dispatchEvent(authEvent);
}
