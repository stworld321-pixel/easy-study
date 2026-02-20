import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

export type CurrencyCode = 'INR' | 'USD';

interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  exchangeRate: number; // Rate relative to INR (INR = 1)
}

const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    exchangeRate: 1,
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    exchangeRate: 0.012, // 1 INR = 0.012 USD (approx)
  },
};

interface CurrencyContextType {
  currency: CurrencyCode;
  currencyConfig: CurrencyConfig;
  setCurrency: (currency: CurrencyCode) => void;
  formatPrice: (priceInINR: number) => string;
  convertPrice: (priceInINR: number) => number;
  currencies: typeof CURRENCIES;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    const saved = localStorage.getItem('currency');
    return (saved as CurrencyCode) || 'INR';
  });

  useEffect(() => {
    localStorage.setItem('currency', currency);
  }, [currency]);

  const setCurrency = (newCurrency: CurrencyCode) => {
    setCurrencyState(newCurrency);
  };

  const currencyConfig = CURRENCIES[currency];

  const convertPrice = (priceInINR: number): number => {
    if (currency === 'INR') return priceInINR;
    return Math.round(priceInINR * CURRENCIES[currency].exchangeRate * 100) / 100;
  };

  const formatPrice = (priceInINR: number): string => {
    const converted = convertPrice(priceInINR);
    const symbol = currencyConfig.symbol;

    if (currency === 'INR') {
      return `${symbol}${converted.toLocaleString('en-IN')}`;
    }
    return `${symbol}${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <CurrencyContext.Provider value={{
      currency,
      currencyConfig,
      setCurrency,
      formatPrice,
      convertPrice,
      currencies: CURRENCIES,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
