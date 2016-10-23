# Contributing

We'd like to encourage you to contribute to the repository. You can do this by making an [issue ticket](https://github.com/node-influx/node-influx/issues) or, even better, submitting a patch via a pull request.

We try to make it as easy as possible for you but there are a few things to consider when contributing. The following guidelines for contribution should be followed if you want to submit a pull request:

## How to prepare

* You need a [GitHub account](https://github.com/signup/free)
* Submit an [issue ticket](https://github.com/node-influx/node-influx/issues) for your issue if there is not one yet.
	* Describe the issue and include steps to reproduce if it's a bug.
	* Ensure to mention the earliest version that you know is affected.
* If you are able and want to fix this, fork the repository on GitHub

## Make Changes

* In your forked repository, create a topic branch for your upcoming patch. (e.g. `feature--autoplay` or `bugfix--ios-crash`)
	* Usually this is based on the master branch.
	* Create a branch based on master; `git branch
	fix/master/my_contribution master` then checkout the new branch with `git
	checkout fix/master/my_contribution`.  Please avoid working directly on the `master` branch.
* Make sure you follow the established coding style. You can run `npm run test:lint` to verify you're all set.
* Make use of the `.editorconfig`-file if provided with the repository.
* Make commits of logical units and describe them properly, documenting anything new that you add.
* If possible, submit tests to your patch / new feature so it can be tested easily.
* Assure nothing is broken by running all the tests via `npm test`.

## Submit Changes

* Push your changes to a topic branch in your fork of the repository.
* Open a pull request to the this repository and choose the right original branch you want to patch.
* If not done in commit messages (which you really should do) please reference and update your issue with the code changes. But _please do not close the issue yourself_.
* We'll review your changes and respond soon, usually within a day!

## Additional Resources

* [General GitHub documentation](http://help.github.com/)
* [GitHub pull request documentation](http://help.github.com/send-pull-requests/)
