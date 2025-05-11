import { usePlugin, renderWidget } from '@remnote/plugin-sdk';
import { useState, useEffect } from 'react';

export const DocumentEditor = () => {
  const plugin = usePlugin();
  const [focusedRemId, setFocusedRemId] = useState<string | null>(null);
  const [focusedRem, setFocusedRem] = useState<any>(null);
  const [remContent, setRemContent] = useState<string>('');
  const [remChildren, setRemChildren] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedContent, setEditedContent] = useState<string>('');
  const [plainTextContent, setPlainTextContent] = useState<string>('');
  const [status, setStatus] = useState<string>('Ready');
  const [loading, setLoading] = useState<boolean>(false);
  const [debug, setDebug] = useState<string>('');
  const [objectInfo, setObjectInfo] = useState<string>('');
  const [showChildren, setShowChildren] = useState<boolean>(true);
  const [includeChildren, setIncludeChildren] = useState<boolean>(true);
  const [childrenTextContent, setChildrenTextContent] = useState<{id: string, text: string}[]>([]);

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

  // Helper to try to get plain text from a Rem
  const getPlainText = async (remObj: any): Promise<string> => {
    try {
      // Array text handling
      if (remObj.text && Array.isArray(remObj.text)) {
        return remObj.text.join('\n');
      }
      
      // Single string text
      if (typeof remObj.text === 'string') {
        return remObj.text;
      }
      
      if (remObj.plainText) {
        return remObj.plainText;
      }
      
      if (typeof remObj.getPlainText === 'function') {
        return await remObj.getPlainText();
      }
      
      if (typeof remObj.toString === 'function') {
        return remObj.toString();
      }
      
      if (remObj._text) {
        return remObj._text;
      }
      
      // Extract text from content if it's an object with text
      const content = remObj.content || remObj.text;
      if (content && typeof content === 'object' && content.text) {
        return content.text;
      }
      
      return "[Could not extract plain text]";
    } catch (e) {
      console.error("Error getting plain text:", e);
      return "[Error extracting text]";
    }
  };

  // Get children of a Rem
  const getRemChildren = async (remObj: any) => {
    try {
      if (!remObj) return [];
      
      // Try various methods to get children
      if (typeof remObj.getChildren === 'function') {
        return await remObj.getChildren();
      }
      
      if (remObj.children && Array.isArray(remObj.children)) {
        return remObj.children;
      }
      
      // Try using the API
      const remId = remObj._id;
      if (remId && plugin.rem.findOne) {
        const doc = await plugin.rem.findOne(remId);
        if (doc && typeof doc.getChildren === 'function') {
          return await doc.getChildren();
        }
      }
      
      // If direct access to _children exists (internal property)
      if (remObj._children && Array.isArray(remObj._children)) {
        return remObj._children;
      }
      
      setDebug('Could not find children using known methods');
      return [];
    } catch (e) {
      console.error("Error getting children:", e);
      setDebug('Error getting children: ' + JSON.stringify(e));
      return [];
    }
  };

  // Add this helper function to debug object content
  const safePrintObject = (obj: any): string => {
    if (obj === null || obj === undefined) return String(obj);
    
    try {
      // For primitive types, return as is
      if (typeof obj !== 'object') return String(obj);
      
      // For objects, try different approaches
      // First try JSON.stringify
      try {
        return JSON.stringify(obj, (key, value) => {
          if (typeof value === 'function') return '[Function]';
          if (typeof value === 'object' && value !== null) {
            if (key === 'parent' || key === 'children' || key === '_parent') return '[Reference]';
          }
          return value;
        }, 2);
      } catch (e) {
        // If circular reference, try another approach
        const props = Object.getOwnPropertyNames(obj);
        const result: Record<string, any> = {};
        
        for (const prop of props) {
          try {
            if (typeof obj[prop] !== 'function' && !prop.startsWith('_')) {
              if (typeof obj[prop] === 'object' && obj[prop] !== null) {
                result[prop] = '[Object]';
              } else {
                result[prop] = obj[prop];
              }
            }
          } catch (e) {
            result[prop] = '[Error]';
          }
        }
        
        return JSON.stringify(result, null, 2);
      }
    } catch (e) {
      return `[Error serializing object: ${e}]`;
    }
  };

  // Helper to get children plain text - fixed to properly get text content
  const getChildrenPlainText = async (children: any[]): Promise<{id: string, text: string}[]> => {
    const result: {id: string, text: string}[] = [];
    
    for (const child of children) {
      try {
        // First check if child is just an ID reference
        if (typeof child === 'string') {
          // It's likely just an ID, fetch the actual rem
          try {
            const childRem = await plugin.rem.findOne(child);
            if (childRem) {
              const text = await getPlainText(childRem);
              result.push({ id: child, text });
            }
          } catch (e) {
            console.error("Error fetching child from ID:", e);
            result.push({ id: child, text: `[Error loading content for ID: ${child}]` });
          }
        } else {
          // It's a proper object, get text directly
          const text = await getPlainText(child);
          const id = child._id || '';
          result.push({ id, text });
        }
      } catch (e) {
        console.error("Error getting child text:", e);
      }
    }
    
    return result;
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
        setPlainTextContent('');
        setRemChildren([]);
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
      
      // Try to get plain text content
      try {
        const plainText = await getPlainText(focusedRemObj);
        setPlainTextContent(plainText);
        setDebug('Step 4: Got plain text: ' + plainText.substring(0, 50) + (plainText.length > 50 ? '...' : ''));
      } catch (textError) {
        console.error('Error getting plain text:', textError);
        setDebug('Plain text error: ' + JSON.stringify(textError));
      }
      
      // Get children
      if (showChildren) {
        try {
          const children = await getRemChildren(focusedRemObj);
          setRemChildren(children || []);
          setDebug('Step 5: Got ' + (children?.length || 0) + ' children');
          
          // Also get plain text content of children for editing
          const childrenTexts = await getChildrenPlainText(children || []);
          setChildrenTextContent(childrenTexts);
          setDebug('Step 5b: Got text content for ' + childrenTexts.length + ' children');
        } catch (childrenError) {
          console.error('Error getting children:', childrenError);
          setDebug('Children error: ' + JSON.stringify(childrenError));
          setRemChildren([]);
          setChildrenTextContent([]);
        }
      }
      
      setStatus('Reading document content...');
      
      // Try content key directly
      if (focusedRemObj.content) {
        setDebug('Step 6: Found content property directly');
        try {
          // Format content properly
          let contentToFormat = focusedRemObj.content;
          let formattedContent;
          
          if (typeof contentToFormat === 'object') {
            formattedContent = JSON.stringify(contentToFormat, null, 2);
          } else if (typeof contentToFormat === 'string') {
            formattedContent = JSON.stringify({ text: contentToFormat }, null, 2);
          } else {
            formattedContent = JSON.stringify({ value: String(contentToFormat) }, null, 2);
          }
          
          setRemContent(formattedContent);
          setStatus('Document loaded successfully');
          return;
        } catch (error) {
          setDebug('Error formatting content property: ' + JSON.stringify(error));
        }
      }
      
      // Try to get content using the API
      try {
        setDebug('Step 7: Attempting to get content via API');
        
        // Try using getContent() if available
        if (typeof focusedRemObj.getContent === 'function') {
          try {
            const content = await focusedRemObj.getContent();
            setDebug('Step 8: Got content using getContent()');
            
            try {
              // Make sure we properly format content
              let formattedContent;
              
              if (content === null || content === undefined) {
                formattedContent = JSON.stringify({ text: plainTextContent || "" }, null, 2);
              } else if (typeof content === 'object') {
                formattedContent = JSON.stringify(content, null, 2);
              } else if (typeof content === 'string') {
                formattedContent = JSON.stringify({ text: content }, null, 2);
              } else {
                formattedContent = JSON.stringify({ value: String(content) }, null, 2);
              }
              
              // Check if the formatted content is just "[object Object]"
              if (formattedContent === '"[object Object]"') {
                // Create a better representation
                formattedContent = JSON.stringify({
                  text: plainTextContent || "",
                  id: remId || ""
                }, null, 2);
              }
              
              setRemContent(formattedContent);
              setStatus('Document loaded successfully');
              return;
            } catch (formatError) {
              setDebug('Error formatting getContent result: ' + JSON.stringify(formatError));
            }
          } catch (error) {
            setDebug('Error getting content with getContent(): ' + JSON.stringify(error));
          }
        }
        
        // Try creating a formatted content object from the focusedRemObj 
        try {
          setDebug('Step 8b: Creating formatted content from Rem object');
          
          // Debug the object structure
          const objectStructure = safePrintObject(focusedRemObj);
          setDebug(`Object structure: ${objectStructure.substring(0, 200)}${objectStructure.length > 200 ? '...' : ''}`);
          
          // Try to get content in multiple ways
          let contentFound = false;
          
          // Try to access the text content directly
          if (plainTextContent) {
            // Create a simplified version of the Rem
            const simplifiedRem = {
              id: focusedRemObj._id || 'unknown',
              text: plainTextContent
            };
            
            // Try to add a few more basic properties if available
            ['name', 'type', 'tags'].forEach(prop => {
              try {
                if (focusedRemObj[prop] && typeof focusedRemObj[prop] !== 'object') {
                  // @ts-ignore - Type checking issues
                  simplifiedRem[prop] = focusedRemObj[prop];
                }
              } catch (e) {
                // Ignore errors
              }
            });
            
            const formattedContent = JSON.stringify(simplifiedRem, null, 2);
            setRemContent(formattedContent);
            setStatus('Document loaded with text content');
            contentFound = true;
          }
          
          // If we still don't have content, try one more approach
          if (!contentFound) {
            const basicContent = {
              id: focusedRemObj._id || 'unknown',
              content: "[Could not format content]"
            };
            
            if (typeof focusedRemObj.toString === 'function') {
              try {
                const stringContent = focusedRemObj.toString();
                if (stringContent && stringContent !== '[object Object]') {
                  basicContent.content = stringContent;
                }
              } catch (e) {
                // Ignore toString errors
              }
            }
            
            const formattedContent = JSON.stringify(basicContent, null, 2);
            setRemContent(formattedContent);
            setStatus('Document loaded with basic content');
          }
          
          return;
        } catch (formatError) {
          setDebug('Error formatting content: ' + JSON.stringify(formatError));
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
  }, [showChildren]); // Reload when showChildren changes
  
  const handleEditClick = () => {
    setIsEditing(true);
    
    try {
      // Create a JSON representation of the document
      const rawData = {
        id: focusedRemId || '',
        text: plainTextContent || ''
      };
      
      // Try to add the text array directly if available
      if (focusedRem && focusedRem.text && Array.isArray(focusedRem.text)) {
        // @ts-ignore
        rawData.textArray = focusedRem.text;
      }
      
      // Add useful properties from the debug output
      try {
        if (focusedRem) {
          ['updatedAt', 'createdAt', 'type', 'parent'].forEach(prop => {
            if (focusedRem[prop]) {
              // @ts-ignore
              rawData[prop] = focusedRem[prop];
            }
          });
        }
      } catch (e) {
        console.error("Error adding properties:", e);
      }
      
      // Include children if the option is enabled
      if (includeChildren && childrenTextContent.length > 0) {
        // @ts-ignore
        rawData.children = childrenTextContent;
      }
      
      setEditedContent(JSON.stringify(rawData, null, 2));
    } catch (e) {
      // Create a basic fallback
      console.error("Error creating JSON content:", e);
      const basicData = {
        id: focusedRemId || '',
        text: plainTextContent || ''
      };
      
      // Include basic children if the option is enabled
      if (includeChildren && childrenTextContent.length > 0) {
        // @ts-ignore
        basicData.children = childrenTextContent;
      }
      
      setEditedContent(JSON.stringify(basicData, null, 2));
    }
  };
  
  const handleSaveClick = async () => {
    if (!focusedRem) {
      setStatus('No document is selected');
      return;
    }
    
    try {
      setLoading(true);
      setStatus('Saving document...');
      
      let parsedContent;
      try {
        setDebug('Saving: Parsing JSON content');
        // Parse the edited content as JSON
        parsedContent = JSON.parse(editedContent);
        setDebug('JSON parsed successfully: ' + Object.keys(parsedContent).join(', '));
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        setDebug('Error parsing JSON: ' + String(parseError));
        throw new Error('Invalid JSON format. Please check your syntax.');
      }
      
      // Check if we need to save children
      const hasChildren = parsedContent.children && Array.isArray(parsedContent.children);
      
      // Save main document first
      setDebug('Saving: Setting content from JSON for main document');
      
      try {
        // Try using rem API for the main document
        const remDoc = await plugin.rem.findOne(focusedRemId || '');
        if (!remDoc) {
          throw new Error('Document not found for saving');
        }
        
        // Extract the main document content (excluding children)
        const mainContent = { ...parsedContent };
        delete mainContent.children;
        
        // Clean up the content before saving
        ['_id', '__id', 'updatedAt', 'createdAt'].forEach(prop => {
          if (mainContent[prop]) {
            delete mainContent[prop];
          }
        });
        
        // Try to save the plain text first if available
        let savedMainDocument = false;
        
        // First try setText with just the text property if it exists
        if (mainContent.text && typeof remDoc.setText === 'function') {
          try {
            setDebug('Attempting to save main text: ' + String(mainContent.text).substring(0, 50));
            let textToSave;
            
            // Handle array text
            if (Array.isArray(focusedRem.text)) {
              if (typeof mainContent.text === 'string') {
                textToSave = mainContent.text.split('\n');
              } else {
                textToSave = mainContent.text;
              }
            } else {
              textToSave = mainContent.text;
            }
            
            // @ts-ignore
            await remDoc.setText(textToSave);
            setDebug('Saved main document using setText()');
            savedMainDocument = true;
          } catch (textError) {
            console.error('Error saving text:', textError);
            setDebug('Error saving with setText: ' + String(textError));
          }
        }
        
        // If setText didn't work and setContent is available, try that
        if (!savedMainDocument && typeof remDoc.setContent === 'function') {
          try {
            setDebug('Falling back to setContent method');
            // @ts-ignore
            await remDoc.setContent(mainContent);
            setDebug('Saved main document using setContent()');
            savedMainDocument = true;
          } catch (contentError) {
            console.error('Error saving content:', contentError);
            setDebug('Error saving with setContent: ' + String(contentError));
          }
        }
        
        // Last resort - try to create a new version of the document
        if (!savedMainDocument) {
          setDebug('Could not save document with standard methods - trying alternatives');
          
          // Backup approach - just set text directly
          if (typeof remDoc.setText === 'function' && plainTextContent) {
            try {
              // @ts-ignore
              await remDoc.setText(plainTextContent);
              setDebug('Saved main document using setText with original text');
              savedMainDocument = true;
            } catch (backupError) {
              console.error('Backup save error:', backupError);
              setDebug('Backup save error: ' + String(backupError));
            }
          }
        }
        
        if (!savedMainDocument) {
          throw new Error('Could not save document with any available method');
        }
        
        // Now save children if present
        if (hasChildren && includeChildren) {
          setDebug(`Saving changes to ${parsedContent.children.length} children`);
          let savedChildrenCount = 0;
          
          for (let i = 0; i < parsedContent.children.length; i++) {
            const childData = parsedContent.children[i];
            if (childData && childData.id && childData.text) {
              try {
                const childRem = await plugin.rem.findOne(childData.id);
                if (childRem) {
                  // @ts-ignore - ignoring TypeScript errors
                  if (typeof childRem.setText === 'function') {
                    try {
                      // Try to detect if we need an array format
                      const childText = typeof childData.text === 'string' ? 
                        childData.text : JSON.stringify(childData.text);
                        
                      // @ts-ignore
                      await childRem.setText(childText);
                      savedChildrenCount++;
                      setDebug(`Saved child ${i+1} (${childData.id.substring(0, 8)}...)`);
                    } catch (childSetError) {
                      setDebug(`Error setting text for child ${i+1}: ${String(childSetError)}`);
                    }
                  } else {
                    setDebug(`Child ${i+1} doesn't have setText method`);
                  }
                } else {
                  setDebug(`Could not find child ${i+1} with ID: ${childData.id.substring(0, 8)}...`);
                }
              } catch (childError) {
                console.error(`Error saving child ${i+1}:`, childError);
                setDebug(`Error processing child ${i+1}: ${String(childError)}`);
              }
            } else {
              setDebug(`Child ${i+1} has invalid data: ${JSON.stringify(childData)}`);
            }
          }
          
          setDebug(`Successfully saved ${savedChildrenCount} out of ${parsedContent.children.length} children`);
        }
      } catch (saveError) {
        console.error('Save operation error:', saveError);
        setDebug('Save operation error: ' + String(saveError));
        throw new Error(saveError instanceof Error ? saveError.message : 'Unknown save error');
      }
      
      // Finish editing
      setIsEditing(false);
      setStatus('Document saved successfully');
      
      // Reload the document to show the changes
      setDebug('Saving: Reloading document');
      await loadFocusedDocument();
    } catch (error) {
      console.error('Error saving document:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      setDebug('Save error: ' + errorMsg);
      setStatus('Error saving document: ' + errorMsg);
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
  
  const handleToggleChildren = () => {
    setShowChildren(!showChildren);
  };
  
  const renderChildItem = (child: any, index: number) => {
    // Try to get a display name for the child
    const getChildName = () => {
      try {
        // Try to get the plaintext content first
        if (typeof child.getPlainText === 'function') {
          try {
            const text = child.getPlainText();
            if (text) return text;
          } catch (e) {
            // Silent fail, move to next method
          }
        }
        
        if (child.text && typeof child.text === 'string') {
          return child.text.substring(0, 30) + (child.text.length > 30 ? '...' : '');
        }
        
        if (child.plainText) {
          return child.plainText.substring(0, 30) + (child.plainText.length > 30 ? '...' : '');
        }
        
        if (child._text) {
          return child._text.substring(0, 30) + (child._text.length > 30 ? '...' : '');
        }
        
        if (child.name) {
          return child.name;
        }
        
        if (child._id) {
          return `[Item ${child._id.substring(0, 8)}...]`;
        }
        
        return `[Child ${index + 1}]`;
      } catch (e) {
        return `[Child ${index + 1}]`;
      }
    };
    
    const name = getChildName();
    
    return (
      <div 
        key={child._id || index} 
        className="py-1 px-2 hover:bg-gray-100 cursor-pointer rounded text-sm flex items-center"
        onClick={async () => {
          try {
            // Try to navigate to this child
            if (child._id && typeof plugin.rem.findOne === 'function') {
              const rem = await plugin.rem.findOne(child._id);
              if (rem && typeof plugin.focus.focusOn === 'function') {
                // @ts-ignore - Type checking issues
                await plugin.focus.focusOn(rem);
                setDebug(`Focused on child: ${name}`);
              } else {
                setDebug(`Could not focus on child: ${name}`);
              }
            }
          } catch (e) {
            console.error('Error focusing on child:', e);
            setDebug(`Error focusing: ${e}`);
          }
        }}
      >
        <span className="mr-2">•</span>
        <span className="truncate">{name}</span>
      </div>
    );
  };

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-xl font-bold">Document Editor</h1>
      
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <div>
            <strong>Document:</strong> {focusedRem ? 
              <span className="text-green-500">Selected</span> : 
              <span className="text-red-500">None</span>
            }
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleToggleChildren}
              className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 text-gray-800"
            >
              {showChildren ? 'Hide Children' : 'Show Children'}
            </button>
            
            <button
              onClick={handleRefreshClick}
              disabled={loading}
              className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 text-gray-800"
            >
              Refresh
            </button>
          </div>
        </div>
        
        <div className="flex gap-2">
          {!isEditing ? (
            <button 
              onClick={handleEditClick}
              disabled={!focusedRem || loading}
              className="px-3 py-1 bg-blue-500 text-black rounded disabled:bg-gray-300 disabled:text-gray-500 hover:bg-blue-600"
            >
              Edit Document
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <label className="text-sm flex items-center ml-4">
                  <input
                    type="checkbox"
                    checked={includeChildren}
                    onChange={() => setIncludeChildren(!includeChildren)}
                    className="mr-1"
                  />
                  Include Children
                </label>
              </div>
              
              <button 
                onClick={handleSaveClick}
                disabled={loading}
                className="px-3 py-1 bg-green-500 text-black rounded disabled:bg-gray-300 disabled:text-gray-500 hover:bg-green-600"
              >
                Save Changes
              </button>
              <button 
                onClick={handleCancelClick}
                disabled={loading}
                className="px-3 py-1 bg-red-500 text-black rounded disabled:bg-gray-300 disabled:text-gray-500 hover:bg-red-600"
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
      
      <div className="flex gap-4 mt-2">
        {/* Document content panel */}
        <div className="flex-1">
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                Edit document content (JSON format):
              </p>
              <textarea 
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full h-64 border border-gray-300 rounded p-2 font-mono text-sm"
                disabled={loading}
              />
            </div>
          ) : (
            focusedRem && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium">Document content:</p>
                  <div className="text-xs text-gray-500">
                    {plainTextContent ? `${plainTextContent.length} characters` : ''}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {plainTextContent && (
                    <div className="border border-gray-300 rounded p-2 text-sm mb-2">
                      {plainTextContent.split('\n').map((line, i) => (
                        <div key={i}>{line || <br />}</div>
                      ))}
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-500 mt-1">Raw JSON content:</p>
                  <pre className="w-full h-32 border border-gray-300 rounded p-2 overflow-auto text-xs">
                    {remContent || (loading ? "Loading..." : "No content available")}
                  </pre>
                </div>
              </div>
            )
          )}
        </div>
        
        {/* Children panel - only show when not editing */}
        {showChildren && !isEditing && (
          <div className="w-64 border-l pl-3">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-medium">Children:</p>
              <div className="text-xs text-gray-500">
                {remChildren.length} items
              </div>
            </div>
            
            <div className="overflow-auto max-h-64 border rounded p-1">
              {remChildren.length > 0 ? (
                remChildren.map((child, index) => renderChildItem(child, index))
              ) : (
                <div className="text-sm text-gray-500 p-2">No children</div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-4 text-sm">
        <p><strong>Usage:</strong></p>
        <ol className="list-decimal pl-5">
          <li>Click on a document in RemNote to focus it</li>
          <li>Click "Refresh" to load the document</li>
          <li>Toggle "Show Children" to view document's children</li>
          <li>Click "Edit Document" to make changes to the document in JSON format</li>
          <li>Toggle "Include Children" to edit child documents as well</li>
          <li>Click "Save Changes" to update the document and its children</li>
          <li>Click on a child item to navigate to it</li>
        </ol>
      </div>
    </div>
  );
};

renderWidget(DocumentEditor); 