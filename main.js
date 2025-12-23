const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    icon: path.join(__dirname, 'icon.ico'), // Si tienes un icono
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false // Simplificación para empezar
    }
  });

  // Aquí hay un truco:
  // En desarrollo (mientras pruebas) cargamos la URL local.
  // En producción (el .exe final) cargamos el archivo index.html compilado.
  // Como eres Junior, vamos directo a la versión compilada para el EXE:
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  
  // Quita la barra de menú fea de arriba si quieres
  win.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});