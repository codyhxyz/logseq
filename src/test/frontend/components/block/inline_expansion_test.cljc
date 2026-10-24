(ns frontend.components.block.inline-expansion-test
  (:require [frontend.components.block.inline-expansion :as expansion]
            #?(:clj [clojure.test :refer [deftest is testing]]
               :cljs [cljs.test :refer [deftest is testing]])))

(deftest independent-reference-occurrences
  (let [page #uuid "10000000-0000-0000-0000-000000000001"
        first-key (expansion/reference-key [0] page)
        second-key (expansion/reference-key [2] page)
        opened (-> []
                   (expansion/toggle first-key page)
                   (expansion/toggle second-key page))]
    (is (= 2 (count opened)))
    (is (= [{:key second-key :target page}]
           (expansion/toggle opened first-key page)))
    (is (= [{:key first-key :target page}]
           (expansion/close opened second-key)))))

(deftest ancestor-only-cycles
  (let [a #uuid "10000000-0000-0000-0000-000000000001"
        b #uuid "10000000-0000-0000-0000-000000000002"
        c #uuid "10000000-0000-0000-0000-000000000003"]
    (testing "self and longer cycles"
      (is (expansion/cycle? #{a} a))
      (is (expansion/cycle? #{a b c} a)))
    (testing "the same target may open in a separate branch"
      (is (not (expansion/cycle? #{a c} b))))
    (testing "depth does not impose an artificial restriction"
      (is (not (expansion/cycle? (set (range 1000)) b))))))

(deftest preserve-modified-navigation
  (is (expansion/plain-click? {:button 0}))
  (is (expansion/plain-click? {}))
  (doseq [event [{:button 1} {:button 2} {:shift? true}
                 {:meta? true} {:ctrl? true} {:alt? true}]]
    (is (not (expansion/plain-click? event)))))

(deftest removed-references-close-their-editors
  (let [a "10000000-0000-0000-0000-000000000001"
        b "10000000-0000-0000-0000-000000000002"
        opened [{:key [[0] a] :target a} {:key [[2] b] :target b}]]
    (is (= [(second opened)] (expansion/retain-keys opened #{[[2] b]})))
    (is (empty? (expansion/retain-keys opened #{})))))

(deftest formatted-and-repeated-reference-paths
  (let [link ["Link" {:url ["Page_ref" "page-id"]}]
        keys (expansion/reference-keys
              [link ["Plain" " again "] ["Emphasis" [["Bold"] [link link]]]])]
    (is (= #{[[0] "page-id"] [[2 0] "page-id"] [[2 1] "page-id"]} keys))
    (is (= [[0] "page-id"] (expansion/reference-key [0] "page-id")))))
