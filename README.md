# asdfasdads

asdasdasddas

## Features

- **Edit RemNote documents**: Edit the content of your RemNote documents in a simple text editor
- **Edit REM structure**: Modify both the content and structure of a document and its child REMs
- **Real-time sync**: Changes are immediately synced back to RemNote after saving
- **Flexible editing**: Edit in RichText format (for single REMs) or tree format (for REMs with children)

## Usage

1. Install the plugin from the RemNote Plugin Store
2. Open a document in RemNote
3. Click on the Document Editor widget in the right sidebar
4. The widget will display the currently focused document
5. Toggle "Include child REMs" to choose whether to edit just the current REM or the entire tree
6. Click "Edit Document" to start editing
7. Make your changes in the text editor
8. Click "Save Changes" to update the document in RemNote

## Working with RichText Format

When editing a single REM, you'll be working with RemNote's RichText format, which is a JSON representation of formatted text. This allows you to edit the raw structure of the document content, including formatting, links, etc.

For example:
```json
[
  "Hello ",
  {
    "i": "m",
    "b": true,
    "text": "world"
  },
  "!"
]
```

This would render as: "Hello **world**!"

## Working with REM Trees

When the "Include child REMs" option is selected, you'll be editing the entire document structure as a JSON tree. This includes:

- The document's content (RichText)
- All child REMs and their content
- The hierarchical structure of REMs

The tree format looks like:

```json
{
  "id": "rem_id_here",
  "text": ["Document title"],
  "children": [
    {
      "id": "child_rem_id_here",
      "text": ["Child content"],
      "children": []
    },
    {
      "id": "another_child_rem_id",
      "text": ["Another child"],
      "children": []
    }
  ]
}
```

## Development

### Prerequisites

To develop and run this plugin locally, you'll need:

1. [Node.js](https://nodejs.org/) installed on your system
2. [Git](https://git-scm.com/) for version control
3. A code editor (like [Visual Studio Code](https://code.visualstudio.com/))
4. RemNote desktop application installed

### Setting Up the Development Environment

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/remnote-plugin-template-react.git
   cd remnote-plugin-template-react
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a manifest.json file in the public directory:
   ```
   mkdir -p public
   touch public/manifest.json
   ```
   
   Open the manifest.json file and add the following content:
   ```json
   {
     "id": "document-editor-plugin",
     "name": "Document Editor",
     "author": "Your Name",
     "description": "Edit documents and their structure in a text editor interface",
     "version": {
       "major": 0,
       "minor": 1,
       "patch": 0
     },
     "manifestVersion": 1,
     "repoUrl": "https://github.com/yourusername/remnote-document-editor",
     "requestNative": false,
     "requiredScopes": [
       {
         "type": "All",
         "level": "Read"
       }
     ],
     "enableOnMobile": false
   }
   ```
   
   Make sure to replace "Your Name" with your actual name and update the repoUrl with your GitHub repository URL.

4. Start the development server:
   ```
   npm run dev
   ```
   
   This will compile the plugin and start a local server at http://localhost:8080.

### Loading the Plugin in RemNote

1. Open RemNote and navigate to Settings
2. Click on "Plugins" in the left sidebar
3. Go to the "Build" tab
4. Click "Develop from localhost" and enter `http://localhost:8080`
5. You should see a success notification if the plugin loaded correctly
6. The Document Editor widget should now be available in your right sidebar

### Making Changes

1. Edit the source files in the `src` directory
2. The development server will automatically recompile when you save changes
3. To see your changes, refresh RemNote

### Debugging

If you encounter issues:
- Check the developer console in RemNote (Ctrl+Shift+I or Cmd+Option+I)
- If the plugin causes RemNote to crash, you can temporarily disable all plugins by visiting: `http://www.remnote.com/notes?disablePlugins`

## Notes and Limitations

- Be careful when editing the RichText format as incorrect JSON will cause errors
- The plugin works best for documents with a moderate number of children (performance may be slower for very large documents)
- Changes are only saved when you explicitly click "Save Changes"

<!-- ignore-after -->
