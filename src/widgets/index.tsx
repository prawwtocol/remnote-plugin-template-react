import { declareIndexPlugin, ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
import '../style.css';
import '../App.css';

async function onActivate(plugin: ReactRNPlugin) {
  // Register settings
  await plugin.settings.registerStringSetting({
    id: 'name',
    title: 'What is your Name?',
    defaultValue: 'Bob',
  });

  await plugin.settings.registerBooleanSetting({
    id: 'pizza',
    title: 'Do you like pizza?',
    defaultValue: true,
  });

  await plugin.settings.registerNumberSetting({
    id: 'favorite-number',
    title: 'What is your favorite number?',
    defaultValue: 42,
  });

  // Register a command to edit the focused document
  await plugin.app.registerCommand({
    id: 'edit-document-command',
    name: 'Edit Document',
    description: 'Open the document editor for the focused document',
    action: async () => {
      // Check if there's a focused document
      const focusedRemId = await plugin.focus.getFocusedRem();
      
      if (!focusedRemId) {
        await plugin.app.toast("Please focus on a document first");
        return;
      }
      
      // Open the document editor widget and show a toast notification
      await plugin.window.openWidgetInRightSidebar('document_editor');
      await plugin.app.toast("Document editor opened in the right sidebar");
    },
  });

  // Register our document editor widget
  await plugin.app.registerWidget('document_editor', WidgetLocation.RightSidebar, {
    dimensions: { height: 'auto', width: '100%' },
    widgetTabTitle: 'Document Editor'
  });
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);
