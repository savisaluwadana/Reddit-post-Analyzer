import React, { useMemo, useState } from 'react';
import Papa from 'papaparse';

const PREVIEW_ROW_LIMIT = 200;

export const CsvVisualizer: React.FC = () => {
  const [fileName, setFileName] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setFileName(file.name);

    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setHeaders([]);
          setRows([]);
          setSelectedRowIndex(null);
          setParseError(results.errors[0].message || 'Failed to parse CSV');
          return;
        }

        const allRows = (results.data as string[][]).filter((row) => row.length > 0);
        if (allRows.length === 0) {
          setHeaders([]);
          setRows([]);
          setSelectedRowIndex(null);
          setParseError('CSV file is empty.');
          return;
        }

        const [headerRow, ...dataRows] = allRows;
        const normalizedHeaders = headerRow.map((h, i) => (h?.trim() ? h : `Column ${i + 1}`));

        const normalizedRows = dataRows.map((row) => {
          const cloned = [...row];
          while (cloned.length < normalizedHeaders.length) {
            cloned.push('');
          }
          return cloned.slice(0, normalizedHeaders.length);
        });

        setHeaders(normalizedHeaders);
        setRows(normalizedRows);
        setSelectedRowIndex(normalizedRows.length > 0 ? 0 : null);
      },
      error: (error) => {
        setHeaders([]);
        setRows([]);
        setSelectedRowIndex(null);
        setParseError(error.message || 'Failed to parse CSV');
      }
    });
  };

  const clearLoadedCsv = () => {
    setFileName('');
    setHeaders([]);
    setRows([]);
    setSelectedRowIndex(null);
    setParseError(null);
  };

  const previewRows = useMemo(() => rows.slice(0, PREVIEW_ROW_LIMIT), [rows]);
  const selfTextColumnIndex = useMemo(
    () => headers.findIndex((header) => header.trim().toLowerCase() === 'selftext'),
    [headers]
  );
  const selectedRow = useMemo(
    () => (selectedRowIndex !== null && rows[selectedRowIndex] ? rows[selectedRowIndex] : null),
    [rows, selectedRowIndex]
  );

  return (
    <section className="card" style={{ padding: '1.5rem', marginTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ color: 'var(--reddit-orange)', marginBottom: '0.25rem', fontSize: '1.1rem' }}>CSV Visualizer</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Load any CSV (including exported Reddit results) to preview rows and columns.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="input-base" />
          <button className="btn-secondary" onClick={clearLoadedCsv} disabled={!fileName}>
            Clear
          </button>
        </div>
      </div>

      {parseError && (
        <div style={{ color: '#ff4444', marginBottom: '1rem', padding: '0.75rem', border: '1px solid #ff4444', borderRadius: '4px', background: '#2a0808' }}>
          {parseError}
        </div>
      )}

      {fileName && !parseError && (
        <div style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <span>File: {fileName}</span>
          <span>Columns: {headers.length}</span>
          <span>Rows: {rows.length}</span>
          <span>Click a row to view as a single post</span>
          {rows.length > PREVIEW_ROW_LIMIT && <span>Previewing first {PREVIEW_ROW_LIMIT} rows</span>}
        </div>
      )}

      {headers.length > 0 && (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
            <thead>
              <tr style={{ background: '#1a1a1a' }}>
                {headers.map((header, index) => (
                  <th
                    key={`${header}-${index}`}
                    style={{
                      textAlign: 'left',
                      padding: '0.75rem',
                      borderBottom: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      fontSize: '0.8rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em'
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, rowIndex) => (
                <tr
                  key={`row-${rowIndex}`}
                  onClick={() => setSelectedRowIndex(rowIndex)}
                  style={{
                    background: selectedRowIndex === rowIndex ? '#1f1f1f' : 'transparent',
                    cursor: 'pointer'
                  }}
                >
                  {row.map((cell, cellIndex) => {
                    const isSelfTextColumn = cellIndex === selfTextColumnIndex;

                    return (
                      <td
                        key={`cell-${rowIndex}-${cellIndex}`}
                        style={{
                          padding: '0.65rem 0.75rem',
                          borderBottom: '1px solid #242424',
                          color: 'var(--text-muted)',
                          fontSize: '0.85rem',
                          verticalAlign: 'top',
                          maxWidth: isSelfTextColumn ? '520px' : '320px',
                          minWidth: isSelfTextColumn ? '320px' : undefined,
                          lineHeight: isSelfTextColumn ? '1.55' : '1.4',
                          whiteSpace: isSelfTextColumn ? 'pre-wrap' : 'normal',
                          wordBreak: isSelfTextColumn ? 'normal' : 'break-word',
                          overflowWrap: isSelfTextColumn ? 'break-word' : 'anywhere'
                        }}
                      >
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRow && (
        <div className="card" style={{ marginTop: '1rem', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <h3 style={{ color: 'var(--text-main)', fontSize: '1rem' }}>
              Single Post View (Row {selectedRowIndex! + 1} of {rows.length})
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn-secondary"
                onClick={() => setSelectedRowIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev))}
                disabled={selectedRowIndex === null || selectedRowIndex <= 0}
                style={{ padding: '0.35rem 0.7rem' }}
              >
                Prev
              </button>
              <button
                className="btn-secondary"
                onClick={() => setSelectedRowIndex((prev) => (prev !== null && prev < rows.length - 1 ? prev + 1 : prev))}
                disabled={selectedRowIndex === null || selectedRowIndex >= rows.length - 1}
                style={{ padding: '0.35rem 0.7rem' }}
              >
                Next
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '0.6rem' }}>
            {headers.map((header, i) => {
              const isSelfText = header.trim().toLowerCase() === 'selftext';
              return (
                <div key={`${header}-${i}`} style={{ borderTop: '1px solid #242424', paddingTop: '0.5rem' }}>
                  <div style={{ color: 'var(--text-main)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                    {header}
                  </div>
                  <div
                    style={{
                      color: 'var(--text-muted)',
                      whiteSpace: isSelfText ? 'pre-wrap' : 'normal',
                      overflowWrap: 'anywhere',
                      lineHeight: isSelfText ? '1.6' : '1.45'
                    }}
                  >
                    {selectedRow[i] || '-'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
