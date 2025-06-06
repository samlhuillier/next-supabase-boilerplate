"use client";

import { getPrices } from "@/lib/actions/stripe";
import Checkout from "./checkout";
import { useEffect, useState } from "react";

type Price = {
  id: string;
  title: string;
  price: number;
  features: string[];
  description: string;
  productId: string;
};

export default function Price() {
  const [prices, setPrices] = useState<Price[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const fetchedPrices = await getPrices();
        setPrices(fetchedPrices);
      } catch (error) {
        console.error("Error fetching prices:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        Loading prices...
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-16 min-h-screen bg-transparent">
      <div className="w-full max-w-4xl mx-auto rounded-2xl bg-[#f7fbfa] dark:bg-[#181a19] border border-[#232624]">
        <h1 className="text-3xl md:text-4xl font-bold text-center mt-10 mb-8 text-[#232624] dark:text-white">
          Pricing Plans
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-3 border-t border-[#232624] dark:border-[#232624]">
          {prices.map((price, idx) => (
            <div
              key={price.id}
              className={`
                flex flex-col items-center px-8 py-10
                ${
                  idx !== 0
                    ? "border-l border-[#232624] dark:border-[#232624]"
                    : ""
                }
              `}
            >
              <h2 className="text-xl font-semibold mb-1 text-[#232624] dark:text-white">
                {price.title}
              </h2>
              <p className="mb-4 text-gray-500 dark:text-gray-400 text-sm">
                {price.description}
              </p>
              <div className="flex items-end mb-6">
                <span className="text-3xl font-bold text-[#232624] dark:text-white">
                  {price.price === 0 ? "Free" : `$${price.price}`}
                </span>
                {price.price !== 0 && (
                  <span className="ml-1 text-gray-500 dark:text-gray-400 text-base">
                    /mo
                  </span>
                )}
              </div>
              <ul className="mb-8 w-full">
                {price.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center mb-2 text-[#232624] dark:text-gray-200 text-sm"
                  >
                    <svg
                      className="w-4 h-4 text-green-500 mr-2"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                className={`
                  w-full py-2 rounded-lg font-semibold transition
                  text-sm
                  ${
                    price.title === "Pro"
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-[#232624] bg-opacity-10 text-[#232624] dark:bg-white/10 dark:text-white hover:bg-opacity-20"
                  }
                  mt-auto
                `}
              >
                {price.price === 0
                  ? "Get Started"
                  : price.title === "Pro"
                  ? "Upgrade"
                  : "Contact Sales"}
              </button>
              <Checkout priceId={price.productId} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
