import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ReportModal } from './ReportModal';

interface ReportContextType {
  openReportModal: (targetType: string, targetId: string, reportedUid: string, meta?: any) => void;
  closeReportModal: () => void;
}

const ReportContext = createContext<ReportContextType | undefined>(undefined);

export const useReport = () => {
  const context = useContext(ReportContext);
  if (!context) {
    throw new Error('useReport must be used within a ReportProvider');
  }
  return context;
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
