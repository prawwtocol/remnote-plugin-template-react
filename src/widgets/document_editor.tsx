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
  const [tempFilePath, setTempFilePath] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [savedDrafts, setSavedDrafts] = useState<{[key: string]: {timestamp: number, content: string, name: string}}>({}); 
  const [showDraftsModal, setShowDraftsModal] = useState<boolean>(false);

  // Load saved drafts on initial render
  useEffect(() => {
    try {
      const storedDrafts = localStorage.getItem('remnote-document-editor-drafts');
      if (storedDrafts) {
        setSavedDrafts(JSON.parse(storedDrafts));
      }
    } catch (e) {
      console.error('Error loading saved drafts:', e);
    }
  }, []);

  // Helper function to save drafts to localStorage
  const saveDraftsToStorage = (updatedDrafts: {[key: string]: {timestamp: number, content: string, name: string}}) => {
    try {
      localStorage.setItem('remnote-document-editor-drafts', JSON.stringify(updatedDrafts));
      setSavedDrafts(updatedDrafts);
    } catch (e) {
      console.error('Error saving drafts to storage:', e);
      setDebug(`Error saving to localStorage: ${String(e)}`);
    }
  };

  // Save current content as draft
  const saveAsDraft = () => {
    try {
      if (!focusedRemId) {
        setStatus('No document selected to save as draft');
        return;
      }

      // Create a draft name
      const now = new Date();
      const timestamp = now.getTime();
      const dateStr = now.toLocaleString();
      
      // Determine content to save
      let contentToSave = isEditing ? editedContent : remContent;
      
      // Make sure we have valid content
      if (!contentToSave) {
        contentToSave = JSON.stringify({
          id: focusedRemId,
          text: plainTextContent || '',
          savedAt: dateStr
        }, null, 2);
      }
      
      // Create doc name for display
      const docName = plainTextContent 
        ? plainTextContent.substring(0, 30) + (plainTextContent.length > 30 ? '...' : '')
        : `Document ${focusedRemId.substring(0, 8)}`;
      
      // Update drafts
      const newDrafts = {
        ...savedDrafts,
        [focusedRemId + '-' + timestamp]: {
          timestamp,
          content: contentToSave,
          name: docName
        }
      };
      
      saveDraftsToStorage(newDrafts);
      setStatus(`Draft saved: ${docName} at ${dateStr}`);
    } catch (e) {
      console.error('Error saving draft:', e);
      setDebug(`Draft save error: ${String(e)}`);
      setStatus('Error saving draft');
    }
  };
  
  // Load a draft
  const loadDraft = (draftKey: string) => {
    try {
      const draft = savedDrafts[draftKey];
      if (!draft) {
        setStatus('Draft not found');
        return;
      }
      
      // Set the content for editing
      setEditedContent(draft.content);
      setIsEditing(true);
      setStatus(`Draft loaded: ${draft.name} from ${new Date(draft.timestamp).toLocaleString()}`);
      setShowDraftsModal(false);
    } catch (e) {
      console.error('Error loading draft:', e);
      setDebug(`Draft load error: ${String(e)}`);
      setStatus('Error loading draft');
    }
  };
  
  // Delete a draft
  const deleteDraft = (draftKey: string) => {
    try {
      const { [draftKey]: draftToRemove, ...remainingDrafts } = savedDrafts;
      saveDraftsToStorage(remainingDrafts);
      setStatus('Draft deleted');
    } catch (e) {
      console.error('Error deleting draft:', e);
      setDebug(`Draft deletion error: ${String(e)}`);
      setStatus('Error deleting draft');
    }
  };
  
  // Auto-save current document while editing
  useEffect(() => {
    if (isEditing && focusedRemId && editedContent) {
      // Create a debounced auto-save
      const autoSaveTimeout = setTimeout(() => {
        try {
          // Create a special auto-save draft key
          const autoSaveKey = `autosave-${focusedRemId}`;
          
          // Create doc name for display
          const docName = plainTextContent 
            ? plainTextContent.substring(0, 30) + (plainTextContent.length > 30 ? '...' : '')
            : `Document ${focusedRemId.substring(0, 8)}`;
          
          // Update drafts with auto-save
          const newDrafts = {
            ...savedDrafts,
            [autoSaveKey]: {
              timestamp: Date.now(),
              content: editedContent,
              name: `[Auto] ${docName}`
            }
          };
          
          saveDraftsToStorage(newDrafts);
          // No status update to avoid disturbing the user
        } catch (e) {
          console.error('Error auto-saving:', e);
        }
      }, 3000); // Auto-save after 3 seconds of inactivity
      
      // Clean up timeout
      return () => clearTimeout(autoSaveTimeout);
    }
  }, [isEditing, editedContent, focusedRemId]);

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
          setDebug(`Preparing to save changes to ${parsedContent.children.length} children`);
          let savedChildrenCount = 0;
          let failedChildren = 0;
          
          for (let i = 0; i < parsedContent.children.length; i++) {
            const childData = parsedContent.children[i];
            if (childData && childData.id) {
              try {
                setDebug(`Processing child ${i+1} with ID: ${childData.id}`);
                const childRem = await plugin.rem.findOne(childData.id);
                
                if (!childRem) {
                  setDebug(`Could not find child ${i+1} with ID: ${childData.id}`);
                  failedChildren++;
                  continue;
                }
                
                // Save the text content if it exists
                if (childData.text !== undefined) {
                  // @ts-ignore - ignoring TypeScript errors
                  if (typeof childRem.setText === 'function') {
                    try {
                      setDebug(`Saving child ${i+1} text content: ${String(childData.text).substring(0, 20)}...`);
                      
                      // Format text appropriately based on the type
                      let textToSave = childData.text;
                      
                      // Handle array text format if needed
                      if (Array.isArray(textToSave)) {
                        // Already an array, use as is
                        setDebug(`Child ${i+1} text is already an array with ${textToSave.length} items`);
                      } else if (typeof textToSave === 'string') {
                        // Check if we need to convert to array
                        if (childRem.text && Array.isArray(childRem.text)) {
                          textToSave = textToSave.split('\n');
                          setDebug(`Child ${i+1} text converted to array with ${textToSave.length} items`);
                        }
                        // Otherwise use as string
                      } else {
                        // Handle objects or other types
                        textToSave = JSON.stringify(textToSave);
                        setDebug(`Child ${i+1} text converted from object to string`);
                      }
                      
                      // Try different saving approaches
                      try {
                        // @ts-ignore
                        await childRem.setText(textToSave);
                        savedChildrenCount++;
                        setDebug(`Successfully saved child ${i+1}`);
                      } catch (saveErr) {
                        setDebug(`Primary save failed for child ${i+1}, trying alternative: ${String(saveErr)}`);
                        
                        // Try alternative save methods
                        try {
                          const stringText = typeof textToSave === 'string' ? 
                            textToSave : (Array.isArray(textToSave) ? textToSave.join('\n') : String(textToSave));
                          
                          // Force a reload of the child to ensure we're working with fresh data
                          const refreshedChild = await plugin.rem.findOne(childData.id);
                          if (refreshedChild) {
                            // @ts-ignore
                            await refreshedChild.setText(stringText);
                            savedChildrenCount++;
                            setDebug(`Saved child ${i+1} using alternative method`);
                          }
                        } catch (alternativeErr) {
                          setDebug(`All save methods failed for child ${i+1}: ${String(alternativeErr)}`);
                          failedChildren++;
                        }
                      }
                    } catch (textErr) {
                      setDebug(`Error preparing text for child ${i+1}: ${String(textErr)}`);
                      failedChildren++;
                    }
                  } else {
                    setDebug(`Child ${i+1} doesn't have setText method`);
                    failedChildren++;
                  }
                } else {
                  setDebug(`Child ${i+1} has no text content to save`);
                }
              } catch (childError) {
                console.error(`Error saving child ${i+1}:`, childError);
                setDebug(`Error processing child ${i+1}: ${String(childError)}`);
                failedChildren++;
              }
            } else {
              setDebug(`Child ${i+1} has invalid data: ${JSON.stringify(childData)}`);
              failedChildren++;
            }
          }
          
          if (savedChildrenCount > 0) {
            setDebug(`Successfully saved ${savedChildrenCount} out of ${parsedContent.children.length} children`);
          } else if (failedChildren > 0) {
            setDebug(`Failed to save any children (${failedChildren} failures)`);
            throw new Error(`Failed to save child documents. Check debug logs for details.`);
          }
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

  // Function to prepare document content for export
  const prepareDocumentContent = () => {
    if (!focusedRem) {
      setStatus('No document selected');
      return null;
    }
    
    try {
      // Create JSON content 
      const content = {
        id: focusedRemId || '',
        text: plainTextContent || ''
      };
      
      // Include text array if available
      if (focusedRem.text && Array.isArray(focusedRem.text)) {
        // @ts-ignore
        content.textArray = focusedRem.text;
      }
      
      // Include essential metadata
      ['type', 'parent'].forEach(prop => {
        if (focusedRem[prop]) {
          // @ts-ignore
          content[prop] = focusedRem[prop];
        }
      });
      
      // Include children if enabled
      if (includeChildren && childrenTextContent.length > 0) {
        // @ts-ignore
        content.children = childrenTextContent;
      }
      
      return JSON.stringify(content, null, 2);
    } catch (e) {
      console.error('Error preparing content:', e);
      setDebug(`Error preparing content: ${String(e)}`);
      
      // Fallback to basic content
      return JSON.stringify({ 
        id: focusedRemId || '', 
        text: plainTextContent || '' 
      }, null, 2);
    }
  };
  
  // Generate a filename for the document
  const generateFilename = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const docId = focusedRemId ? focusedRemId.substring(0, 8) : 'unknown';
    return `remnote-doc-${docId}-${timestamp}.json`;
  };

  // Generate a VSCode URI for the document
  const generateVSCodeUri = (draftKey: string) => {
    try {
      // Get the draft content
      const draft = savedDrafts[draftKey];
      if (!draft) {
        setDebug(`Draft not found for key: ${draftKey}`);
        return null;
      }
      
      // Create a temporary filename - use simpler format
      const filename = `remnote-${draftKey.split('-')[0]}.json`;
      
      // For VS Code URI, we need to keep the content reasonably short
      // as URIs have length limitations in browsers
      const contentJson = draft.content;
      if (!contentJson || contentJson.length > 100000) {
        setDebug(`Content too large for URI: ${contentJson?.length || 0} chars`);
        return null;
      }
      
      // Try different URI approaches for VS Code
      
      // Approach 1: Use the vscode:// URI scheme with 'untitled' (works in some environments)
      try {
        // This approach creates a new file with content in VS Code
        const encodedContent = encodeURIComponent(contentJson);
        return `vscode://file/untitled:${filename}?${encodedContent}`;
      } catch (e1) {
        console.error('Error with primary VS Code URI approach:', e1);
        setDebug(`Primary VS Code URI approach failed: ${String(e1)}`);
        
        // Approach 2: Use the vscode.dev online editor (works across all browsers)
        try {
          // This will open VS Code web version
          const contentParam = encodeURIComponent(contentJson);
          const webUrl = `https://vscode.dev/# "untitled:${filename}"`;
          setDebug(`Falling back to VS Code web URL: ${webUrl}`);
          return webUrl;
        } catch (e2) {
          console.error('Error with fallback VS Code URI approach:', e2);
          setDebug(`All VS Code URI approaches failed`);
          return null;
        }
      }
    } catch (e) {
      console.error('Error generating VSCode URI:', e);
      setDebug(`VSCode URI error: ${String(e)}`);
      return null;
    }
  };
  
  // Open draft in VSCode
  const openDraftInVSCode = (draftKey: string) => {
    try {
      setLoading(true);
      setStatus('Preparing to open in VS Code...');
      
      // First, try the VS Code URI approach
      const uri = generateVSCodeUri(draftKey);
      if (!uri) {
        throw new Error('Could not generate VS Code URI - content may be too large');
      }
      
      // Try to open VS Code with this URI
      window.open(uri, '_blank');
      
      // Just in case we need a fallback download option
      const draft = savedDrafts[draftKey];
      if (draft) {
        setStatus('Attempted to open in VS Code. If VS Code doesn\'t open, use the "Download" button instead.');
        setDebug(`
VS Code URI generated: ${uri}

Common reasons VS Code might not open:
1. VS Code is not installed on your system
2. The vscode:// protocol handler is not registered
3. The content is too large for a URI parameter

Alternative approaches:
1. Click "Download" to save the file locally, then open in VS Code
2. Install the "VS Code URL Handler" extension in VS Code
3. Configure VS Code as your default JSON editor in your system
        `);
      } else {
        throw new Error('Draft not found');
      }
    } catch (e) {
      console.error('Error opening in VS Code:', e);
      setDebug(`VS Code open error: ${String(e)}`);
      setStatus('Failed to open in VS Code. Use the "Download" button instead.');
    } finally {
      setLoading(false);
    }
  };
  
  // Download a draft as a file
  const downloadDraft = (draftKey: string) => {
    try {
      setLoading(true);
      
      // Get the draft content
      const draft = savedDrafts[draftKey];
      if (!draft) {
        throw new Error('Draft not found');
      }
      
      // Generate filename
      const timestamp = new Date(draft.timestamp).toISOString().replace(/[:.]/g, '-');
      const fileName = `remnote-draft-${draftKey.split('-')[0]}-${timestamp}.json`;
      
      // Create and download the file
      const blob = new Blob([draft.content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      setStatus(`Draft downloaded as ${fileName}`);
    } catch (e) {
      console.error('Error downloading draft:', e);
      setDebug(`Draft download error: ${String(e)}`);
      setStatus('Error downloading draft');
    } finally {
      setLoading(false);
    }
  };

  // APPROACH 1: Copy to clipboard
  const copyToClipboard = async () => {
    try {
      setLoading(true);
      setStatus('Preparing document content...');
      
      const fileContent = prepareDocumentContent();
      if (!fileContent) return;
      
      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(fileContent);
        setStatus('Content copied to clipboard! Paste into your editor, then copy the edited content back.');
        setDebug('Document JSON copied to clipboard. Edit in any text editor and paste back.');
      } catch (clipboardError) {
        console.error('Error copying to clipboard:', clipboardError);
        setDebug(`Clipboard error: ${String(clipboardError)}`);
        
        // Fallback for browsers that don't support clipboard API
        try {
          const textArea = document.createElement('textarea');
          textArea.value = fileContent;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          setStatus('Content copied to clipboard! Paste into your editor, then copy the edited content back.');
        } catch (fallbackError) {
          console.error('Fallback clipboard copy failed:', fallbackError);
          setDebug(`Fallback clipboard error: ${String(fallbackError)}`);
          setStatus('Failed to copy to clipboard. Your browser may not support this feature.');
        }
      }
    } catch (e) {
      console.error('Error in clipboard flow:', e);
      setDebug(`Clipboard error: ${String(e)}`);
      setStatus('Error copying content to clipboard.');
    } finally {
      setLoading(false);
    }
  };
  
  // APPROACH 2: Download as file
  const downloadAsFile = () => {
    try {
      setLoading(true);
      setStatus('Preparing file for download...');
      
      const fileContent = prepareDocumentContent();
      if (!fileContent) return;
      
      const fileName = generateFilename();
      
      // Create a downloadable file with the content
      const blob = new Blob([fileContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      setStatus('File downloaded! Edit and then import changes using the "Import File" button.');
      setDebug(`File downloaded: ${fileName}`);
    } catch (e) {
      console.error('Error downloading file:', e);
      setDebug(`Download error: ${String(e)}`);
      setStatus('Error creating downloadable file.');
    } finally {
      setLoading(false);
    }
  };

  // APPROACH 3: Open in VS Code
  const openInVSCode = () => {
    try {
      setLoading(true);
      setStatus('Preparing to open in VS Code...');
      
      // First save the current document as a draft
      if (!focusedRemId) {
        throw new Error('No document selected');
      }
      
      // Create a draft name
      const now = new Date();
      const timestamp = now.getTime();
      
      // Determine content to save
      const fileContent = prepareDocumentContent();
      if (!fileContent) {
        throw new Error('Failed to prepare document content');
      }
      
      // Create doc name for display
      const docName = plainTextContent 
        ? plainTextContent.substring(0, 30) + (plainTextContent.length > 30 ? '...' : '')
        : `Document ${focusedRemId.substring(0, 8)}`;
      
      // Create a unique key for this VSCode-specific draft
      const vscodeKey = `vscode-${focusedRemId}-${timestamp}`;
      
      // Save to drafts storage
      const newDrafts = {
        ...savedDrafts,
        [vscodeKey]: {
          timestamp,
          content: fileContent,
          name: `[VS Code] ${docName}`
        }
      };
      
      saveDraftsToStorage(newDrafts);
      
      // Try to open directly in VS Code using the URI scheme
      const uri = generateVSCodeUri(vscodeKey);
      if (!uri) {
        throw new Error(`Failed to generate VS Code URI - content may be too large (${fileContent.length} chars)`);
      }
      
      // Try to open VS Code with this URI
      window.open(uri, '_blank');
      
      setStatus('Attempting to open in VS Code. Check your browser for permission requests.');
      setDebug(`
VS Code attempt in progress...
Document saved to browser storage with key: ${vscodeKey}
VS Code URI: ${uri}

If VS Code doesn't open automatically:
1. Check the "Saved Drafts" panel
2. Find the draft named "[VS Code] ${docName}"
3. Use the "VS Code" or "Download" button

Note: The VS Code protocol handler requires:
- VS Code to be installed on your system
- The URL protocol handler to be registered
- On macOS, you may need the "VS Code URL Handler" extension
      `);
      
      // Set a timer to guide the user after a short delay
      setTimeout(() => {
        setStatus('VS Code may not have opened. You can access your document from "Saved Drafts"');
      }, 3000);
      
    } catch (e) {
      console.error('Error in VS Code flow:', e);
      setDebug(`VS Code flow error: ${String(e)}`);
      setStatus('Error opening in VS Code. You can still access the draft from "Saved Drafts".');
      
      // Guide user to saved drafts
      setTimeout(() => {
        setShowDraftsModal(true);
      }, 1500);
    } finally {
      setLoading(false);
    }
  };
  
  // Function to handle file upload (after external editing)
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) {
        setStatus('No file selected');
        return;
      }
      
      setLoading(true);
      setStatus('Reading file...');
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          if (!content) {
            throw new Error('Empty file content');
          }
          
          // Parse the content to verify it's valid JSON
          const parsedContent = JSON.parse(content);
          
          // Set the content for editing
          setEditedContent(JSON.stringify(parsedContent, null, 2));
          
          // Switch to edit mode
          setIsEditing(true);
          setStatus('File imported. Review and click "Save Changes" to apply.');
          setShowUploadModal(false);
        } catch (parseError) {
          console.error('Error parsing file content:', parseError);
          setDebug(`File parse error: ${String(parseError)}`);
          setStatus('Invalid JSON file. Please select a valid JSON file.');
        }
      };
      
      reader.onerror = () => {
        console.error('Error reading file:', reader.error);
        setDebug(`File read error: ${String(reader.error)}`);
        setStatus('Error reading file.');
      };
      
      reader.readAsText(file);
    } catch (e) {
      console.error('Error handling file upload:', e);
      setDebug(`File upload error: ${String(e)}`);
      setStatus('Error handling file upload.');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to handle manual paste
  const pasteFromClipboard = () => {
    setIsEditing(true);
    setEditedContent(""); // Clear the content to make it obvious that user needs to paste
    setStatus('Please paste your JSON content below and click "Save Changes"');
    setDebug('Manual paste mode activated - paste your JSON directly into the editor');
  };
  
  const toggleUploadModal = () => {
    setShowUploadModal(!showUploadModal);
  };

  return (
    <div className="p-4 flex flex-col gap-3 relative">
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
        
        <div className="flex gap-2 flex-wrap">
          {!isEditing ? (
            <>
              <button 
                onClick={handleEditClick}
                disabled={!focusedRem || loading}
                className="px-3 py-1 bg-blue-500 text-black rounded disabled:bg-gray-300 disabled:text-gray-500 hover:bg-blue-600"
              >
                Edit Document
              </button>
              
              <div className="flex-1"></div>

              {/* Browser Storage Options */}
              <div className="text-sm font-medium">Browser Storage:</div>
              
              <button 
                onClick={saveAsDraft}
                disabled={!focusedRem || loading}
                className="px-3 py-1 bg-orange-500 text-black rounded disabled:bg-gray-300 disabled:text-gray-500 hover:bg-orange-600"
                title="Save current document to browser storage"
              >
                Save as Draft
              </button>
              
              <button 
                onClick={() => setShowDraftsModal(true)}
                className="px-3 py-1 bg-yellow-500 text-black rounded disabled:bg-gray-300 disabled:text-gray-500 hover:bg-yellow-600"
                title="View saved drafts"
              >
                Saved Drafts {Object.keys(savedDrafts).length > 0 && `(${Object.keys(savedDrafts).length})`}
              </button>

              <div className="w-full"></div>
              
              <div className="text-sm font-medium mt-2">External Editing:</div>
              
              {/* Approach 1: Clipboard */}
              <button 
                onClick={copyToClipboard}
                disabled={!focusedRem || loading}
                className="px-3 py-1 bg-purple-500 text-black rounded disabled:bg-gray-300 disabled:text-gray-500 hover:bg-purple-600"
                title="Copy JSON to clipboard to edit in external editor"
              >
                Copy to Clipboard
              </button>
              
              {/* Approach 2: Download */}
              <button 
                onClick={downloadAsFile}
                disabled={!focusedRem || loading}
                className="px-3 py-1 bg-indigo-500 text-black rounded disabled:bg-gray-300 disabled:text-gray-500 hover:bg-indigo-600"
                title="Download as a JSON file to edit locally"
              >
                Download File
              </button>
              
              {/* Approach 3: VS Code */}
              <button 
                onClick={openInVSCode}
                disabled={!focusedRem || loading}
                className="px-3 py-1 bg-cyan-500 text-black rounded disabled:bg-gray-300 disabled:text-gray-500 hover:bg-cyan-600"
                title="Try to open in VS Code (may not work in all environments)"
              >
                Open in VS Code
              </button>
              
              {/* Import options */}
              <div className="w-full"></div>
              
              <div className="text-sm font-medium mt-2">Import Changes:</div>
              
              <button 
                onClick={pasteFromClipboard}
                disabled={loading}
                className="px-3 py-1 bg-emerald-500 text-black rounded disabled:bg-gray-300 disabled:text-gray-500 hover:bg-emerald-600"
                title="Paste JSON content from clipboard"
              >
                Paste Content
              </button>
              
              <button 
                onClick={toggleUploadModal}
                disabled={loading}
                className="px-3 py-1 bg-amber-500 text-black rounded disabled:bg-gray-300 disabled:text-gray-500 hover:bg-amber-600"
                title="Import an edited JSON file"
              >
                Import File
              </button>
            </>
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
                onClick={saveAsDraft}
                disabled={loading || !editedContent}
                className="px-3 py-1 bg-orange-500 text-black rounded disabled:bg-gray-300 disabled:text-gray-500 hover:bg-orange-600"
                title="Save as draft without updating document"
              >
                Save as Draft
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
        
        {tempFilePath && (
          <div className="text-xs text-gray-400 font-mono overflow-auto max-h-12 border-t pt-1">
            <strong>Temp File:</strong> {tempFilePath}
          </div>
        )}
      </div>
      
      {/* Document content panel */}
      <div className="flex gap-4 mt-2">
        <div className="flex-1">
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                {editedContent 
                  ? "Edit document content (JSON format):" 
                  : "Paste your JSON content below:"}
              </p>
              <textarea 
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full h-64 border border-gray-300 rounded p-2 font-mono text-sm"
                disabled={loading}
                placeholder={editedContent ? "" : "Paste your JSON content here..."}
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
      
      {/* Upload modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
          <div className="bg-white p-4 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-lg font-bold mb-4">Import JSON File</h2>
            <p className="mb-4">Select a JSON file to import:</p>
            
            <input 
              type="file" 
              accept=".json" 
              onChange={handleFileUpload}
              className="w-full mb-4"
            />
            
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowUploadModal(false)}
                className="px-3 py-1 bg-gray-300 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Drafts modal */}
      {showDraftsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
          <div className="bg-white p-4 rounded-lg shadow-lg max-w-xl w-full">
            <h2 className="text-lg font-bold mb-4">Saved Drafts</h2>
            
            {Object.keys(savedDrafts).length === 0 ? (
              <p className="text-gray-500 mb-4">No saved drafts found</p>
            ) : (
              <div className="max-h-80 overflow-y-auto mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left p-2">Document</th>
                      <th className="text-left p-2">Saved</th>
                      <th className="text-right p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(savedDrafts)
                      .sort(([_keyA, a], [_keyB, b]) => b.timestamp - a.timestamp)
                      .map(([key, draft]) => (
                        <tr key={key} className="border-b">
                          <td className="p-2">{draft.name}</td>
                          <td className="p-2">{new Date(draft.timestamp).toLocaleString()}</td>
                          <td className="p-2 text-right flex justify-end gap-1">
                            <button
                              onClick={() => loadDraft(key)}
                              className="text-blue-500 hover:text-blue-700 px-1"
                              title="Load draft for editing in this widget"
                            >
                              Load
                            </button>
                            <button
                              onClick={() => openDraftInVSCode(key)}
                              className="text-purple-500 hover:text-purple-700 px-1"
                              title="Try to open this draft directly in VS Code"
                            >
                              VS Code
                            </button>
                            <button
                              onClick={() => downloadDraft(key)}
                              className="text-green-500 hover:text-green-700 px-1"
                              title="Download this draft as a JSON file"
                            >
                              Download
                            </button>
                            <button
                              onClick={() => deleteDraft(key)}
                              className="text-red-500 hover:text-red-700 px-1"
                              title="Delete this draft"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="flex justify-end">
              <button 
                onClick={() => setShowDraftsModal(false)}
                className="px-3 py-1 bg-gray-300 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="mt-4 text-sm">
        <p><strong>Usage:</strong></p>
        <ol className="list-decimal pl-5">
          <li>Click on a document in RemNote to focus it</li>
          <li>Click "Refresh" to load the document</li>
          <li>Toggle "Show Children" to view document's children</li>
          <li>External editing options:
            <ul className="list-disc pl-5 mt-1">
              <li><strong>Edit Document</strong> - Edit directly in this widget</li>
              <li><strong>Copy to Clipboard</strong> - Copy JSON to clipboard to edit in your preferred editor</li>
              <li><strong>Download File</strong> - Download as a JSON file to edit locally</li>
              <li><strong>Open in VS Code</strong> - Try to open document in VS Code (experimental)</li>
            </ul>
          </li>
          <li>Import your changes:
            <ul className="list-disc pl-5 mt-1">
              <li><strong>Paste Content</strong> - Manually paste edited JSON content</li>
              <li><strong>Import File</strong> - Upload an edited JSON file</li>
            </ul>
          </li>
          <li>Toggle "Include Children" to edit child documents as well</li>
          <li>Click "Save Changes" to update the document and its children</li>
          <li>Browser storage options:
            <ul className="list-disc pl-5 mt-1">
              <li><strong>Save as Draft</strong> - Save current document to browser storage</li>
              <li><strong>Saved Drafts</strong> - View and load previously saved drafts</li>
              <li><strong>Open in VS Code</strong> - Creates a special draft and attempts to open it in VS Code</li>
              <li>From the Drafts panel, you can directly open any draft in VS Code or download it</li>
              <li>Documents are auto-saved while editing (every 3 seconds)</li>
            </ul>
          </li>
        </ol>
      </div>
    </div>
  );
};

renderWidget(DocumentEditor); 