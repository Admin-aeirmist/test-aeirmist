const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

// Import useNavigationType
if (!code.includes('useNavigationType')) {
  code = code.replace(/import \{([^}]+)useLocation([^}]+)\} from 'react-router-dom';/, "import {$1useLocation, useNavigationType$2} from 'react-router-dom';");
}

// 1. In AppContent, get navigationType
code = code.replace(/const location = useLocation\(\);/, 'const location = useLocation();\n  const navigationType = useNavigationType();');

// 2. popstate logic
const popstateRegex = /\/\/ Listen to popstate event \(back\/forward button\)[\s\S]*?window\.removeEventListener\('popstate', handlePopState\);\n  \}, \[\]\);/m;
const newPopstateLogic = `// Listen to React Router POP events (back/forward button)
  useEffect(() => {
    if (navigationType === 'POP') {
      isPoppingRef.current = true;
      const poppedState = location.state;
      if (poppedState && poppedState._appNav) {
        setActiveTab(poppedState.activeTab === 'notifications' ? 'feed' : poppedState.activeTab);
        setViewingProfile(poppedState.viewingProfile);
        setViewingPostId(poppedState.viewingPostId || null);
        setViewingVideoId(poppedState.viewingVideoId || null);
        setViewingStoreId(poppedState.viewingStoreId || null);
        setViewingProductId(poppedState.viewingProductId || null);
        setMessageRecipient(poppedState.messageRecipient);
        setIsPosting(poppedState.isPosting);
        setIsNotificationsOpen(poppedState.isNotificationsOpen);
        setIsAccountSwitcherOpen(poppedState.isAccountSwitcherOpen);
        setSettingsSection(poppedState.settingsSection || null);
        if (poppedState.storyState) {
          setStoryState(poppedState.storyState);
          window.dispatchEvent(new CustomEvent('aeirmist-story-state-restore', { detail: poppedState.storyState }));
        }

        const restoredTab = poppedState.activeTab === 'notifications' ? 'feed' : poppedState.activeTab;
        if (restoredTab && tabHistoryStackRef.current[tabHistoryStackRef.current.length - 1] !== restoredTab) {
          tabHistoryStackRef.current.push(restoredTab);
        }
        
        requestAnimationFrame(() => {
          setTimeout(() => {
            isPoppingRef.current = false;
          }, 100);
        });
      } else {
        const pathInit = getInitialStateFromPath(location.pathname);
        setActiveTab(pathInit.tab);
        setIsNotificationsOpen(pathInit.notifs);
        setSettingsSection(null);
        setViewingProfile(null);
        setViewingPostId(pathInit.postId || null);
        setViewingVideoId(pathInit.videoId || null);
        setViewingStoreId(pathInit.storeId || null);
        setViewingProductId(pathInit.productId || null);
        if (pathInit.chatUid) setMessageRecipient({ id: pathInit.chatUid });
        else setMessageRecipient(null);
        setIsPosting(!!pathInit.isPosting);
        
        requestAnimationFrame(() => {
          setTimeout(() => {
            isPoppingRef.current = false;
          }, 100);
        });
      }
    }
  }, [location.key, navigationType, location.pathname, location.state]);`;

code = code.replace(popstateRegex, newPopstateLogic);

// 3. sync logic
const syncStateRegex = /\/\/ Sync state changes to window\.history and browser URL[\s\S]*?\}\, \[\n    activeTab,[\s\S]*?navigate\n  \]\);/m;
const newSyncStateLogic = `// Sync state changes to browser URL via React Router
  useEffect(() => {
    if (isPoppingRef.current) return;
    if (isGuidelinesPage || location.pathname === '/community-guidelines') return;

    const stateToPush = {
      activeTab, viewingProfile, viewingPostId, viewingVideoId, viewingStoreId, viewingProductId, messageRecipient,
      isPosting, isNotificationsOpen, isAccountSwitcherOpen, storyState, settingsSection, _appNav: true
    };

    const targetUrl = getPathForAppState(
      activeTab, viewingProfile, isNotificationsOpen, viewingPostId, viewingVideoId, viewingStoreId, viewingProductId,
      messageRecipient?.id || null, storyState.activeStoryGroup?.userId || null, settingsSection, isPosting
    );

    if (location.pathname !== targetUrl) {
      navigate(targetUrl, { state: stateToPush });
    } else {
      navigate(targetUrl, { replace: true, state: stateToPush });
    }
  }, [activeTab, viewingProfile, viewingPostId, viewingVideoId, viewingStoreId, viewingProductId, messageRecipient, isPosting, isNotificationsOpen, isAccountSwitcherOpen, storyState, settingsSection, location.pathname, navigate]);`;

code = code.replace(syncStateRegex, newSyncStateLogic);

// 4. init logic
const initRegex = /\/\/ Initialize history state on mount[\s\S]*?window\.history\.replaceState\(s, '', targetUrl\);\n    \}\n  \}\, \[\]\);/m;
const newInitLogic = `// Initialize history state on mount
  useEffect(() => {
    const currentPath = window.location.pathname;
    const pathInit = getInitialStateFromPath(currentPath);
    
    const initialState = {
      activeTab: pathInit.tab, viewingProfile: null, viewingPostId: pathInit.postId || null, viewingVideoId: pathInit.videoId || null, viewingStoreId: pathInit.storeId || null, viewingProductId: pathInit.productId || null, messageRecipient: pathInit.chatUid ? { id: pathInit.chatUid } : null, isPosting: !!pathInit.isPosting, isNotificationsOpen: pathInit.notifs, isAccountSwitcherOpen: false, settingsSection: pathInit.settingsSection || null, storyState: { activeStoryGroup: pathInit.storyUserId ? { userId: pathInit.storyUserId } : null, isStudioOpen: false, isCreatingNote: false }, _appNav: true
    };

    setActiveTab(pathInit.tab);
    if (pathInit.postId) setViewingPostId(pathInit.postId);
    if (pathInit.videoId) setViewingVideoId(pathInit.videoId);
    if (pathInit.storeId) setViewingStoreId(pathInit.storeId);
    if (pathInit.productId) setViewingProductId(pathInit.productId);
    if (pathInit.chatUid) setMessageRecipient({ id: pathInit.chatUid });
    if (pathInit.username || pathInit.userId) setViewingProfile({ username: pathInit.username, id: pathInit.userId });
    if (pathInit.notifs) setIsNotificationsOpen(true);
    if (pathInit.settingsSection) setSettingsSection(pathInit.settingsSection);
    if (pathInit.isPosting) setIsPosting(true);
    
    const targetUrl = getPathForAppState(
      pathInit.tab, null, pathInit.notifs, pathInit.postId || null, pathInit.videoId || null, pathInit.storeId || null, pathInit.productId || null, pathInit.chatUid || null
    );
    navigate(targetUrl, { replace: true, state: initialState });
  }, []);`;

code = code.replace(initRegex, newInitLogic);

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx updated successfully.');
