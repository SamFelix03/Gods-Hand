import { createRequire } from "module";
import webpack from "webpack";
import HtmlWebpackPlugin from "html-webpack-plugin";
import Dotenv from "dotenv-webpack";

const require = createRequire(import.meta.url);

export default (_, argv) => ({
  entry: {
    main: "./app/main.tsx", // Change to .tsx
  },
  target: "web",
  devtool: "source-map",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./app/index.html",
      scriptLoading: "module",
    }),
    new Dotenv({ path: "./.env" }),
    new webpack.ProvidePlugin({ Buffer: ["buffer", "Buffer"] }),
  ],
  resolve: {
    extensions: [".tsx", ".ts", ".js"], // Add .tsx
    fallback: {
      tty: false,
      path: false,
      net: false,
      crypto: false,
      util: require.resolve("util/"),
      assert: require.resolve("assert/"),
      buffer: require.resolve("buffer/"),
    },
  },
  devServer: {
    port: 3000,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    client: {
      overlay: false,
    },
  },
});
