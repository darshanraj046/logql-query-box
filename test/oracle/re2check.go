package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"regexp/syntax"
)

func main() {
	in := bufio.NewScanner(os.Stdin)
	in.Buffer(make([]byte, 1024*1024), 64*1024*1024)
	out := bufio.NewWriter(os.Stdout)
	defer out.Flush()
	for in.Scan() {
		var p string
		if err := json.Unmarshal(in.Bytes(), &p); err != nil {
			panic(err)
		}
		_, err := syntax.Parse(p, syntax.Perl)
		if err == nil {
			_, err = regexp.Compile(p)
		}
		fmt.Fprintln(out, err == nil)
	}
}
