/**
 * Data Access Layer (DAL) & Store
 * Separates data persistence from UI rendering.
 * Supports LocalStorage caching, Local Dataset fallback, JSON/CSV Export & Import,
 * and extensible Hooks for Google Sheets API / MCP integration.
 */

const STORAGE_KEY = 'MICROREGISTRAR_APP_DATA_V1';
const METADATA_KEY = 'MICROREGISTRAR_APP_META_V1';

class DataService {
  constructor() {
    this.data = null;
    this.subscribers = [];
    this.sourceType = 'local'; // 'local' or 'sheets_api'
    this.apiConfig = null;
    this.loadInitialData();
  }

  /**
   * Initialize state from localStorage or fall back to default window.INITIAL_SHEET_DATA
   */
  loadInitialData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.data = JSON.parse(stored);
      } else if (window.INITIAL_SHEET_DATA) {
        this.data = JSON.parse(JSON.stringify(window.INITIAL_SHEET_DATA));
        this.persist();
      } else {
        this.data = { index: {}, interactive_hyn: [], subjects: {} };
      }
    } catch (err) {
      console.error('Error loading stored data:', err);
      if (window.INITIAL_SHEET_DATA) {
        this.data = JSON.parse(JSON.stringify(window.INITIAL_SHEET_DATA));
      } else {
        this.data = { index: {}, interactive_hyn: [], subjects: {} };
      }
    }
  }

  /**
   * Persist current state to localStorage
   */
  persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      localStorage.setItem(METADATA_KEY, JSON.stringify({
        lastModified: new Date().toISOString(),
        version: '1.0'
      }));
      this.notifySubscribers();
    } catch (err) {
      console.error('Failed to persist to localStorage:', err);
    }
  }

  /**
   * Subscribe to data change events
   */
  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  notifySubscribers() {
    for (const cb of this.subscribers) {
      try {
        cb(this.data);
      } catch (e) {
        console.error(e);
      }
    }
  }

  /**
   * Get all registered subject sheet names
   */
  getSubjectNames() {
    if (!this.data || !this.data.subjects) return [];
    return Object.keys(this.data.subjects);
  }

  /**
   * Get records for a specific section/sheet
   */
  getRecords(sheetKey) {
    if (!this.data) return [];
    if (sheetKey === 'interactive_hyn') {
      return this.data.interactive_hyn || [];
    }
    if (this.data.subjects && this.data.subjects[sheetKey]) {
      return this.data.subjects[sheetKey] || [];
    }
    return [];
  }

  /**
   * Get all records across the entire knowledge base (for global search)
   */
  getAllRecords() {
    const results = [];
    if (!this.data) return results;

    // Interactive HYN
    if (this.data.interactive_hyn) {
      this.data.interactive_hyn.forEach(r => {
        results.push({
          ...r,
          sheetKey: 'interactive_hyn',
          sheetName: 'Interactive HYN'
        });
      });
    }

    // Subjects
    if (this.data.subjects) {
      Object.keys(this.data.subjects).forEach(sname => {
        const rows = this.data.subjects[sname] || [];
        rows.forEach(r => {
          results.push({
            ...r,
            sheetKey: sname,
            sheetName: sname
          });
        });
      });
    }

    return results;
  }

  /**
   * Get high-level summary statistics
   */
  getStats() {
    const all = this.getAllRecords();
    const totalRecords = all.length;
    const withLinks = all.filter(r => r.url && r.url.trim() !== '').length;
    const subjectsCount = this.getSubjectNames().length + 1; // + Interactive HYN
    const completedCount = all.filter(r => r.completed || r.rev1 || r.rev2).length;

    return {
      totalRecords,
      withLinks,
      subjectsCount,
      completedCount,
      lastUpdated: new Date().toLocaleDateString()
    };
  }

  /**
   * Create a new record in a sheet
   */
  addRecord(sheetKey, recordData) {
    const id = 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const newRecord = {
      ...recordData,
      id,
      date_updated: recordData.date_updated || new Date().toISOString().split('T')[0]
    };

    if (sheetKey === 'interactive_hyn') {
      if (!this.data.interactive_hyn) this.data.interactive_hyn = [];
      this.data.interactive_hyn.unshift(newRecord);
    } else {
      if (!this.data.subjects[sheetKey]) this.data.subjects[sheetKey] = [];
      this.data.subjects[sheetKey].unshift(newRecord);
    }

    this.persist();
    return newRecord;
  }

  /**
   * Update an existing record
   */
  updateRecord(sheetKey, recordId, updatedFields) {
    let targetList = [];
    if (sheetKey === 'interactive_hyn') {
      targetList = this.data.interactive_hyn || [];
    } else if (this.data.subjects && this.data.subjects[sheetKey]) {
      targetList = this.data.subjects[sheetKey] || [];
    }

    const index = targetList.findIndex(r => r.id === recordId);
    if (index === -1) {
      throw new Error(`Record with ID ${recordId} not found in ${sheetKey}`);
    }

    targetList[index] = {
      ...targetList[index],
      ...updatedFields,
      date_updated: updatedFields.date_updated || targetList[index].date_updated || new Date().toISOString().split('T')[0]
    };

    this.persist();
    return targetList[index];
  }

  /**
   * Delete a record by ID
   */
  deleteRecord(sheetKey, recordId) {
    if (sheetKey === 'interactive_hyn') {
      if (!this.data.interactive_hyn) return false;
      const initialLen = this.data.interactive_hyn.length;
      this.data.interactive_hyn = this.data.interactive_hyn.filter(r => r.id !== recordId);
      if (this.data.interactive_hyn.length !== initialLen) {
        this.persist();
        return true;
      }
    } else if (this.data.subjects && this.data.subjects[sheetKey]) {
      const initialLen = this.data.subjects[sheetKey].length;
      this.data.subjects[sheetKey] = this.data.subjects[sheetKey].filter(r => r.id !== recordId);
      if (this.data.subjects[sheetKey].length !== initialLen) {
        this.persist();
        return true;
      }
    }
    return false;
  }

  /**
   * Reset data to initial sheet snapshot
   */
  resetToInitial() {
    if (window.INITIAL_SHEET_DATA) {
      this.data = JSON.parse(JSON.stringify(window.INITIAL_SHEET_DATA));
      this.persist();
      return true;
    }
    return false;
  }

  /**
   * Export all data as JSON
   */
  exportJSON() {
    const jsonStr = JSON.stringify(this.data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `microregistrar_data_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Export a single sheet or active view as CSV
   */
  exportSheetCSV(sheetKey) {
    const records = this.getRecords(sheetKey);
    if (!records.length) {
      alert('No records to export in this tab.');
      return;
    }

    const headers = ['Category', 'Topic', 'URL', 'Date Updated', 'Revision 1', 'Revision 2', 'Completed'];
    const rows = records.map(r => [
      `"${(r.category || r.group || '').replace(/"/g, '""')}"`,
      `"${(r.topic || '').replace(/"/g, '""')}"`,
      `"${(r.url || '').replace(/"/g, '""')}"`,
      `"${(r.date_updated || '').replace(/"/g, '""')}"`,
      r.rev1 ? 'TRUE' : 'FALSE',
      r.rev2 ? 'TRUE' : 'FALSE',
      r.completed ? 'TRUE' : 'FALSE'
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sheetKey}_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Import data from JSON file
   */
  async importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          if (parsed && (parsed.subjects || parsed.interactive_hyn)) {
            this.data = parsed;
            this.persist();
            resolve(true);
          } else {
            reject(new Error('Invalid dataset format. Missing subjects or interactive_hyn.'));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Google Sheets Connector placeholder & config for future live sync
   */
  configureSheetsAPI(config) {
    this.apiConfig = config;
    this.sourceType = 'sheets_api';
    localStorage.setItem('SHEETS_API_CONFIG', JSON.stringify(config));
  }
}

// Global singleton instance
window.dataService = new DataService();
