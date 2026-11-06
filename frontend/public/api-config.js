// Local static servers (for example Live Server on port 64779) use the local API.
// A separately deployed frontend can set this to the root API deployment origin.
const isLocalStudyroom = ["localhost", "127.0.0.1"].includes(window.location.hostname);
window.STUDYROOM_API_BASE = window.STUDYROOM_API_BASE || (isLocalStudyroom ? "http://localhost:3000" : "");
