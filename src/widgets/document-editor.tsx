import { usePlugin, renderWidget, useTracker, RichTextInterface } from '@remnote/plugin-sdk';
import { useState, useEffect } from 'react';

interface RemTreeNode {
  id: string;
  text: RichTextInterface;
  children: RemTreeNode[];
}

function DocumentEditor() {
  const plugin = usePlugin();
  const [focusedRemId, setFocusedRemId] = useState<string | undefined>(undefined);
  const [remContent, setRemContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedContent, setEditedContent] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [includeChildren, setIncludeChildren] = useState<boolean>(true);
  const [remTree, setRemTree] = useState<RemTreeNode | null>(null);

  // Track the currently focused rem
  useEffect(() => {
    const fetchFocusedRem = async () => {
      const focusedRem = await plugin.focus.getFocusedRem();
      if (focusedRem) {
        setFocusedRemId(focusedRem);
      }
    };
    
    fetchFocusedRem();
    
    // Set up an event listener to track changes to the focused rem
    const unsubscribe = plugin.event.addListener('FocusedRemChange', async () => {
      fetchFocusedRem();
    });
    
    return () => unsubscribe();
  }, []);

  // Get rem content when focusedRemId changes or includeChildren changes
  useEffect(() => {
    const getRemContent = async () => {
      if (!focusedRemId) return;
      
      try {
        const rem = await plugin.rem.findOne(focusedRemId);
        if (!rem) {
          setStatus('Error: Selected rem not found');
          return;
        }
        
        if (includeChildren) {
          // Build a tree of the rem and its children
          const remTreeData = await buildRemTree(rem);
          setRemTree(remTreeData);
          const remTreeJson = JSON.stringify(remTreeData, null, 2);
          setRemContent(remTreeJson);
        } else {
          // Just get the text content of the rem
          const text = await rem.getText();
          const textStr = JSON.stringify(text, null, 2);
          setRemContent(textStr);
        }
        
        setStatus('Loaded document content');
      } catch (error) {
        const err = error as Error;
        setStatus(`Error loading rem: ${err.message}`);
      }
    };
    
    getRemContent();
  }, [focusedRemId, includeChildren]);

  // Recursively build a tree of rems
  const buildRemTree = async (rem: any): Promise<RemTreeNode> => {
    const text = await rem.getText();
    const children = await rem.getChildren();
    
    const childNodes: RemTreeNode[] = [];
    for (const child of children) {
      const childNode = await buildRemTree(child);
      childNodes.push(childNode);
    }
    
    return {
      id: rem._id,
      text,
      children: childNodes
    };
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setEditedContent(remContent);
  };

  const handleSaveClick = async () => {
    if (!focusedRemId) {
      setStatus('Error: No rem selected');
      return;
    }
    
    try {
      // Parse the edited content
      const parsedContent = JSON.parse(editedContent);
      
      if (includeChildren) {
        // Update the entire tree
        await updateRemTree(parsedContent);
        setStatus('Document and children saved successfully');
      } else {
        // Just update the focused rem
        const rem = await plugin.rem.findOne(focusedRemId);
        if (!rem) {
          setStatus('Error: Selected rem not found');
          return;
        }
        await rem.setText(parsedContent);
        setStatus('Document saved successfully');
      }
      
      setIsEditing(false);
      
      // Refresh content
      const newRem = await plugin.rem.findOne(focusedRemId);
      if (includeChildren) {
        const newTree = await buildRemTree(newRem);
        setRemTree(newTree);
        setRemContent(JSON.stringify(newTree, null, 2));
      } else {
        const newText = await newRem.getText();
        setRemContent(JSON.stringify(newText, null, 2));
      }
    } catch (error) {
      const err = error as Error;
      setStatus(`Error saving changes: ${err.message}`);
    }
  };

  // Recursively update a tree of rems
  const updateRemTree = async (node: RemTreeNode) => {
    const rem = await plugin.rem.findOne(node.id);
    if (!rem) {
      throw new Error(`Rem with ID ${node.id} not found`);
    }
    
    // Update the rem's text
    await rem.setText(node.text);
    
    // Get existing children to compare
    const existingChildren = await rem.getChildren();
    
    // Update existing children
    for (let i = 0; i < Math.min(existingChildren.length, node.children.length); i++) {
      await updateRemTree(node.children[i]);
    }
    
    // If we have more children in the tree than exist, create new ones
    if (node.children.length > existingChildren.length) {
      for (let i = existingChildren.length; i < node.children.length; i++) {
        const newRem = await plugin.rem.createRem();
        await newRem.setText(node.children[i].text);
        await rem.addChild(newRem);
        
        // Recursively create children of this new rem
        for (const childNode of node.children[i].children) {
          const newChildRem = await plugin.rem.createRem();
          await newChildRem.setText(childNode.text);
          await newRem.addChild(newChildRem);
        }
      }
    }
    
    // If we have fewer children in the tree than exist, remove the extras
    if (node.children.length < existingChildren.length) {
      for (let i = node.children.length; i < existingChildren.length; i++) {
        await existingChildren[i].remove();
      }
    }
  };

  const handleCancelClick = () => {
    setIsEditing(false);
    setStatus('Edit canceled');
  };

  const handleIncludeChildrenToggle = () => {
    setIncludeChildren(!includeChildren);
  };

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-xl font-bold">Document Editor</h1>
      
      <div className="flex flex-col gap-2">
        <div>
          <strong>Currently Focused Document:</strong> {focusedRemId ? 
            <span className="text-green-500">Selected</span> : 
            <span className="text-red-500">None</span>
          }
        </div>
        
        <label className="flex items-center gap-2">
          <input 
            type="checkbox" 
            checked={includeChildren} 
            onChange={handleIncludeChildrenToggle}
            disabled={isEditing}
          />
          Include child REMs
        </label>
        
        <div className="flex gap-2">
          {!isEditing ? (
            <button 
              onClick={handleEditClick}
              disabled={!focusedRemId}
              className="px-3 py-1 bg-blue-500 text-white rounded disabled:bg-gray-300"
            >
              Edit Document
            </button>
          ) : (
            <>
              <button 
                onClick={handleSaveClick}
                className="px-3 py-1 bg-green-500 text-white rounded"
              >
                Save Changes
              </button>
              <button 
                onClick={handleCancelClick}
                className="px-3 py-1 bg-red-500 text-white rounded"
              >
                Cancel
              </button>
            </>
          )}
        </div>
        
        <div className="text-sm text-gray-500">
          {status}
        </div>
      </div>
      
      {isEditing ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            {includeChildren 
              ? "Edit your document and its children below. This is the raw format with the complete tree structure." 
              : "Edit your document below. This is the raw RichText format."}
          </p>
          <textarea 
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="w-full h-64 border border-gray-300 rounded p-2 font-mono"
          />
        </div>
      ) : (
        focusedRemId && (
          <div className="flex flex-col gap-2">
            <p className="text-sm">
              {includeChildren 
                ? "Document content with child REMs (tree structure):" 
                : "Document content (RichText format):"}
            </p>
            <pre className="w-full h-64 border border-gray-300 rounded p-2 overflow-auto text-xs">
              {remContent}
            </pre>
          </div>
        )
      )}
    </div>
  );
}

renderWidget(DocumentEditor); 