import PropTypes from 'prop-types';

export default function DataTable({ rows }) {
  if (!rows || rows.length === 0) {
    return <p className="status">No hay registros disponibles.</p>;
  }

  const columns = Object.keys(rows[0]);

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              {columns.map((col) => (
                <td key={`${idx}-${col}`}>{row[col] ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

DataTable.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.object)
};
