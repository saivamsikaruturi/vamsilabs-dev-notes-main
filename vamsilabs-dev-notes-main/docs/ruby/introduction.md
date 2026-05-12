# Ruby Fundamentals

## Overview

Ruby is a dynamic, interpreted, object-oriented programming language designed for developer happiness and productivity. Created by Yukihiro "Matz" Matsumoto in 1995, Ruby follows the principle of least surprise.

!!! info "Everything is an Object"
    In Ruby, **everything** is an object — including numbers, booleans, and even `nil`. Every value has methods and belongs to a class.

```ruby
5.class          # => Integer
"hello".class    # => String
nil.class        # => NilClass
true.class       # => TrueClass
```

## Core Data Types

### Strings

```ruby
# String creation
name = "Ruby"
greeting = 'Hello'

# String interpolation (only with double quotes)
puts "#{greeting}, #{name}!"   # => Hello, Ruby!

# Common methods
"hello".upcase        # => "HELLO"
"Hello World".split   # => ["Hello", "World"]
"ruby".length         # => 4
"hello".reverse       # => "olleh"
"hello".include?("ell")  # => true
```

### Arrays

```ruby
# Creation
fruits = ["apple", "banana", "cherry"]
numbers = Array.new(3, 0)   # => [0, 0, 0]

# Access and manipulation
fruits[0]           # => "apple"
fruits << "date"    # append
fruits.push("fig")  # append
fruits.pop          # remove last

# Iteration and transformation
fruits.each { |f| puts f }
fruits.map { |f| f.upcase }
fruits.select { |f| f.length > 5 }
fruits.reject { |f| f.start_with?("a") }

# Useful methods
[1, 2, 3, 4, 5].reduce(:+)   # => 15
[3, 1, 2].sort                # => [1, 2, 3]
[1, 2, 2, 3].uniq             # => [1, 2, 3]
```

### Hashes

```ruby
# Creation (symbol keys preferred)
person = { name: "Alice", age: 30, city: "NYC" }

# Access
person[:name]       # => "Alice"
person.fetch(:age)  # => 30

# Iteration
person.each do |key, value|
  puts "#{key}: #{value}"
end

# Useful methods
person.keys         # => [:name, :age, :city]
person.values       # => ["Alice", 30, "NYC"]
person.merge(job: "Developer")
person.select { |k, v| v.is_a?(String) }
```

### Symbols

```ruby
# Symbols are immutable identifiers, commonly used as hash keys
:name
:status

# Symbols vs Strings
"hello".object_id != "hello".object_id  # different objects each time
:hello.object_id == :hello.object_id    # same object always (memory efficient)
```

!!! tip "When to use Symbols"
    Use symbols for identifiers, hash keys, and method names. Use strings for text data that may change.

## Blocks, Procs, and Lambdas

### Blocks

Blocks are anonymous chunks of code passed to methods.

```ruby
# Block with do...end
[1, 2, 3].each do |num|
  puts num * 2
end

# Block with curly braces (single line)
[1, 2, 3].map { |num| num * 2 }

# Yielding to a block
def greet(name)
  puts "Before"
  yield(name) if block_given?
  puts "After"
end

greet("Ruby") { |n| puts "Hello, #{n}!" }
```

### Procs

Procs are saved blocks — objects that hold code.

```ruby
square = Proc.new { |x| x ** 2 }
square.call(5)   # => 25
square.(5)       # => 25 (shorthand)

# Procs don't enforce argument count
my_proc = Proc.new { |a, b| "#{a} and #{b}" }
my_proc.call(1)  # => "1 and " (no error)
```

### Lambdas

Lambdas are stricter procs with argument checking and different return behavior.

```ruby
multiply = ->(a, b) { a * b }
multiply.call(3, 4)  # => 12

# Lambdas enforce argument count
multiply.call(3)     # => ArgumentError

# Return behavior difference
def proc_return
  p = Proc.new { return "from proc" }
  p.call
  "after proc"  # never reached
end

def lambda_return
  l = -> { return "from lambda" }
  l.call
  "after lambda"  # this IS reached
end
```

!!! warning "Proc vs Lambda"
    - **Proc**: Does not check argument count. `return` exits the enclosing method.
    - **Lambda**: Checks argument count. `return` only exits the lambda itself.

## Object-Oriented Programming

### Classes

```ruby
class Animal
  attr_accessor :name, :sound
  attr_reader :species

  def initialize(name, species, sound)
    @name = name
    @species = species
    @sound = sound
  end

  def speak
    "#{@name} says #{@sound}!"
  end

  def self.kingdom
    "Animalia"
  end

  private

  def secret_method
    "This is private"
  end
end

dog = Animal.new("Rex", "Canine", "Woof")
dog.speak            # => "Rex says Woof!"
Animal.kingdom       # => "Animalia"
```

### Inheritance

```ruby
class Dog < Animal
  def fetch(item)
    "#{@name} fetches the #{item}!"
  end

  def speak
    super + " Woof woof!"
  end
end
```

### Modules and Mixins

Modules provide namespacing and mixins (Ruby's alternative to multiple inheritance).

```ruby
module Swimmable
  def swim
    "#{name} is swimming!"
  end
end

module Flyable
  def fly
    "#{name} is flying!"
  end
end

class Duck < Animal
  include Swimmable
  include Flyable
end

duck = Duck.new("Donald", "Aves", "Quack")
duck.swim   # => "Donald is swimming!"
duck.fly    # => "Donald is flying!"
```

!!! note "include vs extend"
    - `include` adds module methods as **instance methods**.
    - `extend` adds module methods as **class methods**.

## Metaprogramming Basics

Ruby allows programs to examine and modify their own structure at runtime.

```ruby
# define_method — dynamically create methods
class Report
  ["pdf", "csv", "html"].each do |format|
    define_method("generate_#{format}") do
      "Generating #{format.upcase} report..."
    end
  end
end

report = Report.new
report.generate_pdf   # => "Generating PDF report..."
report.generate_csv   # => "Generating CSV report..."

# method_missing — catch undefined method calls
class DynamicGreeter
  def method_missing(method_name, *args)
    if method_name.to_s.start_with?("greet_")
      language = method_name.to_s.sub("greet_", "")
      "Hello from #{language}!"
    else
      super
    end
  end

  def respond_to_missing?(method_name, include_private = false)
    method_name.to_s.start_with?("greet_") || super
  end
end

greeter = DynamicGreeter.new
greeter.greet_french   # => "Hello from french!"

# send — call methods by name
"hello".send(:upcase)  # => "HELLO"
```

!!! warning "Metaprogramming Caution"
    Use metaprogramming sparingly. It makes code harder to debug and understand. Always implement `respond_to_missing?` alongside `method_missing`.

## Ruby on Rails Overview

Rails is a full-stack web framework following **Convention over Configuration** and the **MVC** pattern.

```bash
# Create new Rails app
gem install rails
rails new myapp
cd myapp
rails server
```

**Key components:**

| Component | Purpose |
|-----------|---------|
| ActiveRecord | ORM for database interaction |
| ActionController | Handles HTTP requests |
| ActionView | Template rendering |
| ActiveJob | Background job processing |
| ActionMailer | Email sending |
| ActionCable | WebSocket support |

```ruby
# Model
class Article < ApplicationRecord
  belongs_to :author
  has_many :comments
  validates :title, presence: true, length: { minimum: 5 }
end

# Controller
class ArticlesController < ApplicationController
  def index
    @articles = Article.all
  end

  def create
    @article = Article.new(article_params)
    if @article.save
      redirect_to @article
    else
      render :new, status: :unprocessable_entity
    end
  end

  private

  def article_params
    params.require(:article).permit(:title, :body)
  end
end
```

## Gems and Bundler

Gems are Ruby's package system. Bundler manages gem dependencies.

```ruby
# Gemfile
source "https://rubygems.org"

gem "rails", "~> 7.1"
gem "pg"
gem "puma"
gem "sidekiq"

group :development, :test do
  gem "rspec-rails"
  gem "factory_bot_rails"
end
```

```bash
# Install dependencies
bundle install

# Add a gem
bundle add devise

# Update gems
bundle update

# Execute in bundle context
bundle exec rails server
```

**Popular gems:**

- **Devise** — Authentication
- **Pundit** — Authorization
- **Sidekiq** — Background jobs
- **RSpec** — Testing framework
- **Pry** — Debugging console
- **Rubocop** — Linting and formatting
