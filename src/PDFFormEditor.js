import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument } from 'pdf-lib';
import { Upload, Save } from 'lucide-react';
import { GlobalWorkerOptions } from 'pdfjs-dist';
import pdfjsLib from 'pdfjs-dist/build/pdf';

const workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url);
GlobalWorkerOptions.workerSrc = workerSrc.toString();
const PDFFormEditor = () => {
// pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

  const [pdfFile, setPdfFile] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [formFields, setFormFields] = useState({});
  const [pdfBytes, setPdfBytes] = useState(null);

  const loadPDF = async (file) => {
    try {
      // Create URL for react-pdf viewer
      const fileUrl = URL.createObjectURL(file);
      setPdfFile(fileUrl);

      // Load PDF document for form handling
      const arrayBuffer = await file.arrayBuffer();
      setPdfBytes(arrayBuffer);
      
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      setPdfDoc(pdfDoc);

      // Get form fields
      const form = pdfDoc.getForm();
      const fields = form.getFields();
      
      // Create initial form field values
      const fieldValues = {};
      fields.forEach(field => {
        const fieldName = field.getName();
        const type = field.constructor.name;
        
        switch (type) {
          case 'PDFTextField':
            fieldValues[fieldName] = form.getTextField(fieldName).getText() || '';
            break;
          case 'PDFCheckBox':
            fieldValues[fieldName] = form.getCheckBox(fieldName).isChecked();
            break;
          case 'PDFRadioGroup':
            fieldValues[fieldName] = form.getRadioGroup(fieldName).getSelected() || '';
            break;
          case 'PDFDropdown':
            fieldValues[fieldName] = form.getDropdown(fieldName).getSelected() || '';
            break;
          default:
            console.log(`Unsupported field type: ${type}`);
        }
      });
      
      setFormFields(fieldValues);
    } catch (error) {
      console.error('Error loading PDF:', error);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      loadPDF(file);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  // Function to update PDF form fields when user interacts with the viewer
  const updateFormField = async (fieldName, value) => {
    try {
      const newPdfDoc = await PDFDocument.load(pdfBytes);
      const form = newPdfDoc.getForm();
      const field = form.getFields().find(f => f.getName() === fieldName);

      if (field) {
        const type = field.constructor.name;
        
        switch (type) {
          case 'PDFTextField':
            form.getTextField(fieldName).setText(value);
            break;
          case 'PDFCheckBox':
            if (value) {
              form.getCheckBox(fieldName).check();
            } else {
              form.getCheckBox(fieldName).uncheck();
            }
            break;
          case 'PDFRadioGroup':
            form.getRadioGroup(fieldName).select(value);
            break;
          case 'PDFDropdown':
            form.getDropdown(fieldName).select(value);
            break;
        }
      }

      // Save the updated PDF
      const modifiedPdfBytes = await newPdfDoc.save();
      setPdfBytes(modifiedPdfBytes);
      
      // Update the viewer
      const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      const fileUrl = URL.createObjectURL(blob);
      setPdfFile(fileUrl);

      // Update form fields state
      setFormFields(prev => ({
        ...prev,
        [fieldName]: value
      }));
    } catch (error) {
      console.error('Error updating form field:', error);
    }
  };

  const handleSave = async () => {
    try {
      // Create a new PDF document from the current state
      const newPdfDoc = await PDFDocument.load(pdfBytes);
      
      // Save the PDF
      const savedPdfBytes = await newPdfDoc.save();
      
      // Create download link
      const blob = new Blob([savedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'filled-form.pdf';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error saving PDF:', error);
    }
  };

  // Add event listener for PDF viewer form field interactions
  useEffect(() => {
    const handlePDFFormFieldChange = (event) => {
      if (event.target.classList.contains('annotationLayer')) {
        // Get the field name and value from the event
        const fieldName = event.target.querySelector('input, select')?.name;
        const value = event.target.querySelector('input, select')?.value;
        
        if (fieldName && value !== undefined) {
          updateFormField(fieldName, value);
        }
      }
    };

    document.addEventListener('change', handlePDFFormFieldChange);
    return () => {
      document.removeEventListener('change', handlePDFFormFieldChange);
    };
  }, [pdfBytes]);
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div>
        <div className="flex items-center justify-between">
          <span>PDF Form Editor</span>
          <div className="flex gap-2">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button variant="outline" size="icon">
                <Upload className="h-4 w-4" />
              </button>
            </label>
            <button
              variant="outline"
              size="icon"
              onClick={handleSave}
              disabled={!pdfFile}
            >
              <Save className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <div>
        <div className="min-h-[600px] w-full bg-gray-100 rounded-lg overflow-auto">
          {pdfFile ? (
            <Document
              file={pdfFile}
              onLoadSuccess={onDocumentLoadSuccess}
              className="flex flex-col items-center"
            >
              <Page
                pageNumber={currentPage}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
              {numPages > 1 && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage <= 1}
                  >
                    Previous
                  </button>
                  <span className="py-2">
                    Page {currentPage} of {numPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, numPages))}
                    disabled={currentPage >= numPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </Document>
          ) : (
            <div className="text-gray-500 text-center py-20">
              <Upload className="h-12 w-12 mx-auto mb-2" />
              <p>Upload a PDF form to fill</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFFormEditor;
