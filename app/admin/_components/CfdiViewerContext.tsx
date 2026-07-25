'use client';

import React, { createContext, useContext, useState } from 'react';
import CfdiViewerModal from '../gastos/_components/CfdiViewerModal';

interface CfdiViewerContextType {
  openCfdi: (xmlUrl: string | null | undefined) => void;
  closeCfdi: () => void;
  cfdiUrl: string | null;
}

const CfdiViewerContext = createContext<CfdiViewerContextType>({
  openCfdi: () => {},
  closeCfdi: () => {},
  cfdiUrl: null,
});

export function CfdiViewerProvider({ children }: { children: React.ReactNode }) {
  const [cfdiUrl, setCfdiUrl] = useState<string | null>(null);

  const openCfdi = (xmlUrl: string | null | undefined) => {
    if (!xmlUrl) return;
    let path = xmlUrl.trim();
    if (path.includes(',')) {
      path = path.split(',')[0].trim();
    }
    setCfdiUrl(path);
  };

  const closeCfdi = () => setCfdiUrl(null);

  return (
    <CfdiViewerContext.Provider value={{ openCfdi, closeCfdi, cfdiUrl }}>
      {children}
      {cfdiUrl && (
        <CfdiViewerModal xmlUrl={cfdiUrl} onClose={closeCfdi} />
      )}
    </CfdiViewerContext.Provider>
  );
}

export function useCfdiViewer() {
  return useContext(CfdiViewerContext);
}
