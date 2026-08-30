for f in programs/*/src/lib.rs; do echo '#![allow(deprecated, unexpected_cfgs)]' > temp.rs; cat $f >> temp.rs; mv temp.rs $f; done
