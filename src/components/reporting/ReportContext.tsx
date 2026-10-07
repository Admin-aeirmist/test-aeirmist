import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ReportModal } from './ReportModal';

interface ReportContextType {
  openReportModal: (targetType: string, targetId: string, reportedUid: string, meta?: any) => void;
  closeReportModal: () => void;
}

const defaultReportContext: ReportContextType = {
  openReportModal: (_targetType: string, _targetId: string, _reportedUid: string, _meta?: any) => {
    console.warn('[Report] openReportModal called outside ReportProvider');
  },
  closeReportModal: () => {},
};

const ReportContext = createContext<ReportContextType>(defaultReportContext);

export const useReport = () => {
  const context = useContext(ReportContext);
  return context || defaultReportContext;
};

export const ReportProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [reportData, setReportData] = useState<{
    targetType: string;
    targetId: string;
    reportedUid: string;
    meta?: any;
  } | null>(null);

  const openReportModal = (targetType: string, targetId: string, reportedUid: string, meta?: any) => {
    setReportData({ targetType, targetId, reportedUid, meta });
    setIsOpen(true);
  };

  const closeReportModal = () => {
    setIsOpen(false);
    setTimeout(() => setReportData(null), 300); // Wait for exit animation
  };

  return (
    <ReportContext.Provider value={{ openReportModal, closeReportModal }}>
      {children}
      {isOpen && reportData && (
        <ReportModal 
          isOpen={isOpen}
          onClose={closeReportModal}
          targetType={reportData.targetType}
          targetId={reportData.targetId}
          reportedUid={reportData.reportedUid}
          meta={reportData.meta}
        />
      )}
    </ReportContext.Provider>
  );
};
