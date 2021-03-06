import * as React from 'react';
import ReactWindow, { VariableSizeList, areEqual } from 'react-window';
import { Measurer, useTableMeasurer } from './Measurer';
import {
  Column,
  WindowTableProps,
  RowCellsProps,
  HeaderRowProps,
} from './core/types';
import { areTablePropsEqual } from './helpers/areTablePropsEqual';
import {
  ReactElement,
  useRef,
  useContext,
  createContext,
  memo,
  useMemo,
  useState,
  useEffect,
  useCallback,
} from 'react';

const TableContext = createContext({
  columns: [] as Column<any, any>[],
  data: [] as any[],
  Cell: 'div' as React.ElementType,
  Row: 'div' as React.ElementType,
  Table: 'div' as React.ElementType,
  Body: 'div' as React.ElementType,
  classNamePrefix: '',
  tableClassName: '',
  rowClassName: '' as string | Function,
  rowWidthOffset: 0,
  setSize: (() => ({})) as any,
  variableSizeRows: false as boolean,
});

const RowCells = ({
  columns,
  classNamePrefix,
  datum,
  Cell,
  index = 0,
  setSize,
}: RowCellsProps) => {
  return (
    <>
      {columns.map((column, i) => {
        const { key, width, Component = 'div' } = column;
        // Using i as the key, because it doesn't matter much,
        // as we are only looping through columns in one row only
        const extraProps =
          typeof Component === 'string'
            ? {}
            : {
                row: datum,
                column,
                index,
                setSize: setSize || (() => {}),
              };
        return (
          <Cell
            key={i}
            style={{
              width: `${width}px`,
              flexGrow: width,
              display: 'inline-block',
              boxSizing: 'border-box',
            }}
            className={`${classNamePrefix}table-cell`}
            row={datum}
            column={column}
            index={index}
          >
            <Component {...extraProps}>{datum[key]}</Component>
          </Cell>
        );
      })}
    </>
  );
};

const RowRenderer: React.FunctionComponent<ReactWindow.ListChildComponentProps> = ({
  index,
  style,
}) => {
  const {
    columns,
    data,
    Cell,
    classNamePrefix,
    Row,
    rowClassName,
    setSize,
    variableSizeRows,
  } = useContext(TableContext);

  const rowClassNameStr = useMemo(
    () =>
      typeof rowClassName === 'function' ? rowClassName(index) : rowClassName,
    [index, rowClassName]
  );

  const setSizeRef = useRef(setSize);
  const setSizeCb = useCallback(() => {
    if (!variableSizeRows && index !== 0) {
      return;
    }
    const el = document.querySelector(`#window-table-row-ref-${index}`);
    if (!el) {
      return;
    }

    if (el.scrollHeight > el.getBoundingClientRect().height) {
      setSizeRef.current(index, el?.scrollHeight + 1 || 0);
    }
  }, [index, variableSizeRows]);

  useEffect(() => {
    setTimeout(() => {
      setSizeCb();
    }, 0);
  }, [index, style.height, setSizeCb]);

  return (
    <Row
      id={`window-table-row-ref-${index}`}
      style={{
        ...style,
        display: 'flex',
        overflow: 'auto',
      }}
      className={`${classNamePrefix}${rowClassNameStr} ${classNamePrefix}${rowClassNameStr}-${index}`}
      index={index}
      row={data[index]}
    >
      <RowCells
        datum={data[index]}
        Cell={Cell}
        classNamePrefix={classNamePrefix}
        columns={columns}
        index={index}
        setSize={setSizeCb}
      />
    </Row>
  );
};
const MemoRowRenderer = memo(RowRenderer, areEqual);

const HeaderRowRenderer: React.FunctionComponent<HeaderRowProps> = ({
  Header,
  HeaderRow,
  HeaderCell: DefaultHeaderCell,
  children,
}) => {
  const { columns, classNamePrefix, rowWidthOffset } = useContext(TableContext);
  const rowRef = useRef<HTMLElement>(null);

  const color =
    rowRef &&
    rowRef.current &&
    rowRef.current.firstChild &&
    getComputedStyle(rowRef.current.firstChild as Element).backgroundColor;

  return (
    <Header
      id="window-table-header-ref"
      className={`${classNamePrefix}table-header`}
      style={{ backgroundColor: color }}
    >
      <HeaderRow
        style={{
          display: 'flex',
          width: `calc(100% - ${rowWidthOffset}px)`,
        }}
        className={`${classNamePrefix}table-header-row`}
        ref={rowRef}
      >
        {children}
        {columns.map(column => {
          const { key, width, title, HeaderCell = DefaultHeaderCell } = column;
          return (
            <HeaderCell
              key={`header${key}`}
              style={{
                width: `${width}px`,
                display: 'inline-block',
                flexGrow: width,
              }}
              className={`${classNamePrefix}table-header-cell`}
              column={column}
            >
              {title}
            </HeaderCell>
          );
        })}
      </HeaderRow>
    </Header>
  );
};

const TableBodyRenderer: React.FunctionComponent = ({ children, ...props }) => {
  const { Table, classNamePrefix, tableClassName, Body } = useContext(
    TableContext
  );

  return (
    <Table {...props} className={tableClassName}>
      <Body className={`${classNamePrefix}table-body`}>{children}</Body>
    </Table>
  );
};

const WindowTable = React.forwardRef(
  <T extends any = any>(
    {
      columns,
      data,
      rowHeight = 40,
      height,
      width,
      overscanCount = 1,
      disableHeader = false,
      style = {},
      Cell = 'div',
      HeaderCell = 'div',
      Table = 'div',
      Header = 'div',
      HeaderRow = 'div',
      Row = 'div',
      Body = 'div',
      className = '',
      rowClassName = 'table-row',
      classNamePrefix = '',
      debounceWait = 0,
      headerCellInnerElementType = 'div',
      tableCellInnerElementType = 'div',
      variableSizeRows = false,
      tableOuterRef,
      tableOuterElementType,
      ...rest
    }: WindowTableProps<T>,
    ref: React.Ref<ReactWindow.VariableSizeList>
  ) => {
    const localRef = useRef<any>();
    ref = ref || localRef;
    const [headerHeight, setHeaderHeight] = useState(0);

    const measurerRowRef = useRef<HTMLElement>(null);
    const tableClassName = `${classNamePrefix}table ${className}`;

    const columnWidthsSum = columns.reduce((sum, { width }) => sum + width, 0);

    const [dimensions, measure] = useTableMeasurer();

    const [tableHeight, tableWidth] = dimensions.table;

    const bodyHeight: number = (height || tableHeight) - headerHeight;
    const effectiveWidth = width || Math.max(columnWidthsSum, tableWidth);

    const rowWidth =
      (measurerRowRef.current && measurerRowRef.current.clientWidth) ||
      tableWidth;
    const rowWidthOffset = tableWidth - rowWidth;

    const [sizeMap, setSizeMap] = useState({} as any);
    const getItemSize = (index: number) => {
      if (!variableSizeRows) {
        return sizeMap[0] || rowHeight;
      }
      return sizeMap[index] || rowHeight;
    };

    const tblCtx = {
      columns,
      data,
      Cell,
      Row,
      Table,
      Body,
      classNamePrefix,
      tableClassName,
      rowClassName,
      rowWidthOffset,
      variableSizeRows,
      setSize: (index: any, height: any) => {
        if (!height) {
          return;
        }
        // console.log(sizeMap, index, height);
        setSizeMap((map: any) => ({
          ...map,
          [index]: Math.max(height, map[index] || 0),
        }));
        (ref as any)?.current?.resetAfterIndex?.(index);
      },
    };

    const first = sizeMap[0];
    useEffect(() => {
      setHeaderHeight(
        document.querySelector('#window-table-header-ref')?.scrollHeight || 0
      );
    }, [first]);

    return (
      <div
        style={{
          height: height ? `${height}px` : '100%',
          width: width ? `${width}px` : '100%',
          overflow: 'auto',
          maxHeight: '100vh', // By default, table height will be bounded by 100% of viewport height
          minHeight: '200px', // By default, table will have a minimum height
          ...style,
        }}
        {...rest}
      >
        <TableContext.Provider value={tblCtx}>
          <div>
            {!disableHeader && tableWidth > 0 && (
              <Table
                style={{ width: `${effectiveWidth}px`, marginBottom: 0 }}
                className={tableClassName}
              >
                <HeaderRowRenderer
                  Header={Header}
                  HeaderRow={HeaderRow}
                  HeaderCell={HeaderCell}
                />
              </Table>
            )}
            {!!data.length && (
              <VariableSizeList
                ref={ref}
                height={bodyHeight}
                itemCount={data.length}
                itemSize={getItemSize}
                width={effectiveWidth}
                innerElementType={TableBodyRenderer}
                overscanCount={overscanCount}
                outerRef={tableOuterRef}
                outerElementType={tableOuterElementType}
              >
                {MemoRowRenderer}
              </VariableSizeList>
            )}
          </div>
        </TableContext.Provider>

        {(!height || !width) && (
          /*Measure table dimensions only if explicit height or width are not supplied*/
          <Measurer
            measure={measure}
            entity="table"
            debounceWait={debounceWait}
          />
        )}
      </div>
    );
  }
);

declare function WindowTableType<T>(
  props: WindowTableProps<T>
): ReactElement<T>;

export default (memo(
  WindowTable,
  areTablePropsEqual
) as unknown) as typeof WindowTableType;
