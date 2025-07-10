import React from 'react';

interface ElectronWindow extends Window {
  require: (module: string) => any;
}

declare const window: ElectronWindow;

const { ipcRenderer } = window.require("electron");

function App(): React.JSX.Element {
  const handleCheckPermissions = async (): Promise<void> => {
    await ipcRenderer.invoke("check-permissions");
  };

  return (
    <div className="bg-gray-100 h-screen flex items-center justify-center">
      <div className="bg-white shadow-md rounded-md p-6 max-w-md mx-auto text-center">
        <h1 className="text-3xl font-bold text-red-600 mb-4">Permission Denied</h1>
        <p className="mb-6 text-lg text-gray-700">You need to grant permission to use the system audio recorder.</p>
        <button
          onClick={handleCheckPermissions}
          className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-150 ease-in-out"
        >
          Check Permissions Again
        </button>
      </div>
    </div>
  );
}

export default App;