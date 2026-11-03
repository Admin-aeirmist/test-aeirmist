const fs = require('fs');
const path = require('path');

function normalize(str) {
  return str.replace(/\r\n/g, '\n');
}

// 1. Patch ReportsManagementTab.tsx
const repPath = path.join(__dirname, '..', 'src', 'components', 'admin', 'ReportsManagementTab.tsx');
let repContent = normalize(fs.readFileSync(repPath, 'utf8'));

const targetRepEffect = normalize(`  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      logger.warn("Reports list error:", err);
      setLoading(false);
    });
    return () => unsub();
  }, [db]);`);

const replacementRepEffect = normalize(`  useEffect(() => {
    let isMounted = true;
    const loadReportsFallback = async () => {
      try {
        const res = await fetch('/api/v1/admin/reports');
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.reports) && data.reports.length > 0 && isMounted) {
            setReports(prev => prev.length === 0 ? data.reports : prev);
          }
        }
      } catch (err) {
        logger.warn('Reports edge fallback error:', err);
      }
    };
    loadReportsFallback();

    if (!db) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snapshot) => {
      if (snapshot.docs.length > 0) {
        setReports(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        loadReportsFallback();
      }
      setLoading(false);
    }, (err) => {
      logger.warn("Reports list error:", err);
      loadReportsFallback().finally(() => setLoading(false));
    });
    return () => {
      isMounted = false;
      unsub();
    };
  }, [db]);`);

if (repContent.includes(targetRepEffect)) {
  repContent = repContent.replace(targetRepEffect, replacementRepEffect);
  fs.writeFileSync(repPath, repContent, 'utf8');
  console.log('Patched ReportsManagementTab.tsx successfully!');
} else {
  console.log('Target still not found in ReportsManagementTab.tsx');
}

// 2. Patch SupportInboxTab.tsx
const supPath = path.join(__dirname, '..', 'src', 'components', 'admin', 'SupportInboxTab.tsx');
let supContent = normalize(fs.readFileSync(supPath, 'utf8'));

const targetSupEffect = normalize(`  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'supportReports'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setReports(items);
      setLoading(false);
      // Keep selected report updated if open
      if (selectedReport) {
        const updated = items.find(item => item.id === selectedReport.id);
        if (updated) setSelectedReport(updated);
      }
    }, (err) => {
      logger.warn("Support reports listener error:", err);
      setLoading(false);
    });
    return () => unsub();
  }, [db]);`);

const replacementSupEffect = normalize(`  useEffect(() => {
    let isMounted = true;
    const loadTicketsFallback = async () => {
      try {
        const res = await fetch('/api/v1/admin/tickets');
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.tickets) && data.tickets.length > 0 && isMounted) {
            setReports(prev => prev.length === 0 ? data.tickets : prev);
          }
        }
      } catch (err) {
        logger.warn('Tickets edge fallback error:', err);
      }
    };
    loadTicketsFallback();

    if (!db) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'supportReports'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      if (snap.docs.length > 0) {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setReports(items);
        if (selectedReport) {
          const updated = items.find(item => item.id === selectedReport.id);
          if (updated) setSelectedReport(updated);
        }
      } else {
        loadTicketsFallback();
      }
      setLoading(false);
    }, (err) => {
      logger.warn("Support reports listener error:", err);
      loadTicketsFallback().finally(() => setLoading(false));
    });
    return () => {
      isMounted = false;
      unsub();
    };
  }, [db]);`);

if (supContent.includes(targetSupEffect)) {
  supContent = supContent.replace(targetSupEffect, replacementSupEffect);
  fs.writeFileSync(supPath, supContent, 'utf8');
  console.log('Patched SupportInboxTab.tsx successfully!');
} else {
  console.log('Target still not found in SupportInboxTab.tsx');
}
