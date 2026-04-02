import React, { createContext, useContext, useState, useCallback } from 'react';

const UIContext = createContext();

export const UIProvider = ({ children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const openSidebar = useCallback(() => setIsSidebarOpen(true), []);
    const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);
    const toggleSidebar = useCallback(() => setIsSidebarOpen((prev) => !prev), []);

    return (
        <UIContext.Provider value={{ isSidebarOpen, openSidebar, closeSidebar, toggleSidebar }}>
            {children}
        </UIContext.Provider>
    );
};

export const useUI = () => useContext(UIContext);
