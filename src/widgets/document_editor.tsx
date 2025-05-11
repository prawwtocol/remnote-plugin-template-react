import { usePlugin, renderWidget } from '@remnote/plugin-sdk';
import { useState, useEffect } from 'react';

export const DocumentEditor = () => {
  const plugin = usePlugin();
  const [focusedRemId, setFocusedRemId] = useState<string | null>(null);
  const [focusedRem, setFocusedRem] = useState<any>(null);
  const [remContent, setRemContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedContent, setEditedContent] = useState<string>('');
  const [status, setStatus] = useState<string>('Ready');
  const [loading, setLoading] = useState<boolean>(false);
  const [debug, setDebug] = useState<string>('');
  const [objectInfo, setObjectInfo] = useState<string>('');

  // Helper function to inspect object
  const inspectObject = (obj: any): string => {
    if (!obj) return 'null or undefined object';
    
    try {
      // Get methods and properties
      const properties = Object.getOwnPropertyNames(obj);
      const methods = properties.filter(prop => typeof obj[prop] === 'function');
      const regularProps = properties.filter(prop => typeof obj[prop] !== 'function');
      
      // Format as string
      return `Properties: ${regularProps.join(', ')} | Methods: ${methods.join(', ')}`;
    } catch (e) {
      return `Error inspecting object: ${e}`;
    }
  };

  // Load the currently focused document
  const loadFocusedDocument = async () => {
    try {
      setLoading(true);
      setStatus('Getting focused document...');
      setDebug('Step 1: Getting focused document');
      
      // Get the focused document - we get the actual Rem object, not just an ID
      const focusedRemObj = await plugin.focus.getFocusedRem();
      setDebug('Step 2: Got focused document: ' + (focusedRemObj ? 'yes' : 'no'));
      
      if (!focusedRemObj) {
        setStatus('No document is focused - click on a document first');
        setFocusedRem(null);
        setFocusedRemId(null);
        setRemContent('');
        setObjectInfo('');
        return;
      }
      
      // Inspect the object
      const info = inspectObject(focusedRemObj);
      setObjectInfo(info);
      setDebug('Object inspection: ' + info);
      
      // Store the focused document object and ID
      setFocusedRem(focusedRemObj);
      
      // Extract the ID from the object
      const remId = focusedRemObj._id;
      setFocusedRemId(remId);
      
      setDebug('Step 3: Document ID: ' + remId);
      setStatus('Reading document content...');
      
      // Try content key directly
      if (focusedRemObj.content) {
        setDebug('Step 4: Found content property directly');
        const formattedContent = JSON.stringify(focusedRemObj.content, null, 2);
        setRemContent(formattedContent);
        setStatus('Document loaded successfully');
        return;
      }
      
      // Try to get content using the API
      try {
        setDebug('Step 5: Attempting to get content via API');
        
        // Try using getContent() if available
        if (typeof focusedRemObj.getContent === 'function') {
          const content = await focusedRemObj.getContent();
          setDebug('Step 6: Got content using getContent()');
          const formattedContent = JSON.stringify(content, null, 2);
          setRemContent(formattedContent);
          setStatus('Document loaded successfully');
          return;
        }
        
        // Try using API methods
        const remDoc = await plugin.rem.findOne(remId);
        if (remDoc) {
          // Try different properties and methods
          const possibleContentProps = ['content', 'text', 'richText', 'value'];
          
          for (const prop of possibleContentProps) {
            if (remDoc[prop]) {
              setDebug(`Step 7: Found content via property ${prop}`);
              const formattedContent = JSON.stringify(remDoc[prop], null, 2);
              setRemContent(formattedContent);
              setStatus('Document loaded successfully');
              return;
            }
          }
          
          // If we get here, we couldn't find the content
          setDebug('Step 8: Could not find content in any known property');
          setStatus('Document structure not supported - try viewing properties');
        } else {
          setDebug('Step 8: Could not find document with ID ' + remId);
          setStatus('Could not find document - try clicking on a document first');
        }
      } catch (contentError) {
        console.error('Error getting content:', contentError);
        setDebug('Content error: ' + JSON.stringify(contentError));
        setStatus('Error getting document content - try clicking on a document first');
      }
    } catch (error) {
      console.error('Error loading document:', error);
      setDebug('Error: ' + JSON.stringify(error));
      setStatus('Error loading document');
    } finally {
      setLoading(false);
    }
  };
  
  // Load document when the component first mounts
  useEffect(() => {
    // Initial load
    loadFocusedDocument();
    
    // Set up event listener for focus changes
    let cleanup = () => {};
    
    try {
      // Add event listener with workaround for type issues
      const eventHandler = () => {
        loadFocusedDocument();
      };
      
      // @ts-ignore - Ignoring TypeScript errors for event listening
      plugin.event.addListener('FocusedRemChange', eventHandler);
      
      cleanup = () => {
        try {
          // @ts-ignore - Ignoring TypeScript errors for event cleanup
          plugin.event.removeListener('FocusedRemChange', eventHandler);
        } catch (e) {
          console.error('Failed to remove event listener:', e);
        }
      };
    } catch (error) {
      console.error('Error setting up event listener:', error);
      setDebug('Event listener setup error: ' + JSON.stringify(error));
    }
    
    // Return cleanup function
    return cleanup;
  }, []);
  
  const handleEditClick = () => {
    setIsEditing(true);
    setEditedContent(remContent);
  };
  
  const handleSaveClick = async () => {
    if (!focusedRem) {
      setStatus('No document is selected');
      return;
    }
    
    try {
      setLoading(true);
      setStatus('Saving document...');
      setDebug('Saving: Parsing content');
      
      // Parse the edited content
      const parsedContent = JSON.parse(editedContent);
      
      // Use the Rem object directly 
      setDebug('Saving: Setting content');
      
      try {
        // Try using rem API
        const remDoc = await plugin.rem.findOne(focusedRemId);
        if (remDoc) {
          // @ts-ignore - ignoring TypeScript errors for now
          if (typeof remDoc.setContent === 'function') {
            await remDoc.setContent(parsedContent);
            setDebug('Saved using setContent()');
          } else if (typeof remDoc.setText === 'function') {
            await remDoc.setText(parsedContent);
            setDebug('Saved using setText()');
          } else {
            throw new Error('No method to set content found');
          }
        } else {
          throw new Error('Document not found for saving');
        }
      } catch (saveError) {
        throw new Error(`Save error: ${saveError}`);
      }
      
      // Finish editing
      setIsEditing(false);
      setStatus('Document saved successfully');
      
      // Reload the document to show the changes
      setDebug('Saving: Reloading document');
      await loadFocusedDocument();
    } catch (error) {
      console.error('Error saving document:', error);
      setDebug('Save error: ' + JSON.stringify(error));
      setStatus('Error saving document. Check your JSON format.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCancelClick = () => {
    setIsEditing(false);
    setStatus('Edit canceled');
  };
  
  const handleRefreshClick = () => {
    loadFocusedDocument();
  };

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-xl font-bold">Document Editor</h1>
      
      <div className="flex flex-col gap-2">
        <div>
          <strong>Currently Focused Document:</strong> {focusedRem ? 
            <span className="text-green-500">Selected</span> : 
            <span className="text-red-500">None</span>
          }
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleRefreshClick}
            disabled={loading}
            className="text-sm px-2 py-1 bg-gray-200 rounded"
          >
            Refresh
          </button>
          
          {!isEditing ? (
            <button 
              onClick={handleEditClick}
              disabled={!focusedRem || loading}
              className="px-3 py-1 bg-blue-500 text-white rounded disabled:bg-gray-300"
            >
              Edit Document
            </button>
          ) : (
            <>
              <button 
                onClick={handleSaveClick}
                disabled={loading}
                className="px-3 py-1 bg-green-500 text-white rounded disabled:bg-gray-300"
              >
                Save Changes
              </button>
              <button 
                onClick={handleCancelClick}
                disabled={loading}
                className="px-3 py-1 bg-red-500 text-white rounded disabled:bg-gray-300"
              >
                Cancel
              </button>
            </>
          )}
        </div>
        
        <div className="text-sm text-gray-500">
          Status: {status}
          {loading && <span> Loading...</span>}
        </div>
        
        <div className="text-xs text-gray-400 font-mono overflow-auto max-h-24">
          Debug: {debug}
        </div>
        
        {objectInfo && (
          <div className="text-xs text-gray-400 font-mono overflow-auto max-h-24 border-t pt-1">
            <strong>Rem Object:</strong> {objectInfo}
          </div>
        )}
      </div>
      
      {isEditing ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            Edit your document below. This is the raw content format.
          </p>
          <textarea 
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="w-full h-64 border border-gray-300 rounded p-2 font-mono"
            disabled={loading}
          />
        </div>
      ) : (
        focusedRem && (
          <div className="flex flex-col gap-2">
            <p className="text-sm">
              Document content:
            </p>
            <pre className="w-full h-64 border border-gray-300 rounded p-2 overflow-auto text-xs">
              {remContent || (loading ? "Loading..." : "No content available")}
            </pre>
          </div>
        )
      )}
      
      <div className="mt-4 text-sm">
        <p><strong>Usage:</strong></p>
        <ol className="list-decimal pl-5">
          <li>Click on a document in RemNote to focus it</li>
          <li>Click "Refresh" to load the document</li>
          <li>Click "Edit Document" to make changes</li>
          <li>Edit the content representation of the document</li>
          <li>Click "Save Changes" to update the document</li>
        </ol>
      </div>
    </div>
  );
};

renderWidget(DocumentEditor); 