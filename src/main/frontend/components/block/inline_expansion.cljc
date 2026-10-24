(ns frontend.components.block.inline-expansion
  "View-local expansion bookkeeping. Graph references themselves may be cyclic.")

(defn reference-key
  [path reference]
  [path (str reference)])

(defn toggle
  [expansions key target]
  (if (some #(= key (:key %)) expansions)
    (filterv #(not= key (:key %)) expansions)
    (conj expansions {:key key :target target})))

(defn close
  [expansions key]
  (filterv #(not= key (:key %)) expansions))

(defn cycle?
  [ancestor-ids target]
  (contains? ancestor-ids target))

(defn reference-keys
  "Mirror the inline renderer's paths, including formatting around a link."
  ([ast] (reference-keys [] ast))
  ([parent-path ast]
   (into #{}
         (mapcat
          (fn [[index [kind value]]]
            (let [path (conj parent-path index)]
              (case kind
                "Link" (when (= "Page_ref" (first (:url value)))
                         [(reference-key path (second (:url value)))])
                "Emphasis" (reference-keys path (second value))
                ("Superscript" "Subscript") (reference-keys path value)
                nil))))
         (map-indexed vector ast))))

(defn retain-keys
  [expansions keys]
  (filterv #(contains? keys (:key %)) expansions))

(defn plain-click?
  [{:keys [button shift? meta? ctrl? alt?]}]
  (and (or (nil? button) (zero? button))
       (not (or shift? meta? ctrl? alt?))))
