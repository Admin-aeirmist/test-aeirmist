const fs = require('fs');
const path = require('path');

const adminPanelPath = path.join(__dirname, '..', 'src', 'components', 'admin', 'AdminPanel.tsx');
let content = fs.readFileSync(adminPanelPath, 'utf8');

const badBlock = `    const unsub = onSnapshot(collection(db, 'profiles'), (snapshot) => {
      if (snapshot.docs.length > 0) {
        setUsers(snapshot.docs.map(d => normalizeAdminUser({ id: d.id, ...d.data() })));
      } else {
        loadFromApi();
      }
      setLoading(false);
    }, (err) => {
      logger.warn("Profiles list error:", err);
      loadFromApi().finally(() => setLoading(false));
    });
      setUsers(snapshot.docs.map(d => normalizeAdminUser({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      logger.warn("Profiles list error:", err);
      setLoading(false);
    });
    return () => unsub();
  }, [db]);`;

const cleanBlock = `    const unsub = onSnapshot(collection(db, 'profiles'), (snapshot) => {
      if (snapshot.docs.length > 0) {
        setUsers(snapshot.docs.map(d => normalizeAdminUser({ id: d.id, ...d.data() })));
      } else {
        loadFromApi();
      }
      setLoading(false);
    }, (err) => {
      logger.warn("Profiles list error:", err);
      loadFromApi().finally(() => setLoading(false));
    });
    return () => {
      isMounted = false;
      unsub();
    };
  }, [db]);`;

if (content.includes(badBlock)) {
  content = content.replace(badBlock, cleanBlock);
  fs.writeFileSync(adminPanelPath, content, 'utf8');
  console.log('Fixed duplicated block successfully!');
} else {
  // Try normalized replacement
  const normContent = content.replace(/\r\n/g, '\n');
  const normBad = badBlock.replace(/\r\n/g, '\n');
  const normClean = cleanBlock.replace(/\r\n/g, '\n');
  if (normContent.includes(normBad)) {
    content = normContent.replace(normBad, normClean);
    fs.writeFileSync(adminPanelPath, content, 'utf8');
    console.log('Fixed duplicated block (normalized) successfully!');
  } else {
    console.error('Could not find bad block!');
  }
}
